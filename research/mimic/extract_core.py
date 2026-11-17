#!/usr/bin/env python3
from pathlib import Path
import csv
import duckdb
import sys

RAW = Path("/Users/philipbernard/mimic-data/raw/mimiciv/3.1/mimiciv-3.1")
BOOT = Path("/Users/philipbernard/mimic-data/bootstrap/mimiciv-3.1")
OUT = Path("/Users/philipbernard/mimic-data/derived")
MAP = Path(__file__).with_name("item_map.csv")
OUT.mkdir(parents=True, exist_ok=True)

required = {
    "chartevents": RAW / "icu/chartevents.csv.gz",
    "labevents": RAW / "hosp/labevents.csv.gz",
    "patients": BOOT / "hosp/patients.csv.gz",
    "icustays": BOOT / "icu/icustays.csv.gz",
}
missing = [name for name, path in required.items() if not path.exists()]
if missing:
    print("Not ready; missing:", ", ".join(missing))
    sys.exit(2)

with MAP.open() as f:
    rows = list(csv.DictReader(f))
chart_ids = sorted({int(r["itemid"]) for r in rows if r["domain"] == "chart"})
lab_ids = sorted({int(r["itemid"]) for r in rows if r["domain"] == "lab"})
exposure_ids = sorted({int(r["itemid"]) for r in rows if r["domain"] == "chart" and r["role"] == "exposure"})
context_change_ids = [223849, 229314]
transition_ids = sorted(set(exposure_ids + context_change_ids))

con = duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("PRAGMA memory_limit='4GB'")
con.execute("PRAGMA temp_directory='/Users/philipbernard/mimic-data/tmp'")

def esc(p):
    return str(p).replace("'", "''")

adult_path = OUT / "adult_icustays.parquet"
vent_path = OUT / "vent_chart_events.parquet"
lab_path = OUT / "blood_gas_events.parquet"
trans_path = OUT / "ventilator_transition_candidates.parquet"

con.execute(f"""
COPY (
  SELECT i.*, p.gender, p.anchor_age, p.anchor_year, p.anchor_year_group
  FROM read_csv_auto('{esc(required["icustays"])}', header=true) i
  JOIN read_csv_auto('{esc(required["patients"])}', header=true) p USING(subject_id)
  WHERE p.anchor_age >= 18
) TO '{esc(adult_path)}' (FORMAT PARQUET, COMPRESSION ZSTD);
""")

con.execute(f"""
COPY (
  SELECT subject_id, hadm_id, stay_id, caregiver_id, charttime, storetime,
         itemid, value, valuenum, valueuom, warning
  FROM read_csv_auto('{esc(required["chartevents"])}', header=true, sample_size=200000)
  WHERE itemid IN ({','.join(map(str, chart_ids))})
) TO '{esc(vent_path)}' (FORMAT PARQUET, COMPRESSION ZSTD);
""")

con.execute(f"""
COPY (
  SELECT subject_id, hadm_id, specimen_id, itemid, charttime, storetime,
         value, valuenum, valueuom, ref_range_lower, ref_range_upper,
         flag, priority
  FROM read_csv_auto('{esc(required["labevents"])}', header=true, sample_size=200000)
  WHERE itemid IN ({','.join(map(str, lab_ids))})
) TO '{esc(lab_path)}' (FORMAT PARQUET, COMPRESSION ZSTD);
""")

con.execute(f"""
COPY (
  WITH x AS (
    SELECT *,
      lag(valuenum) OVER (PARTITION BY stay_id, itemid ORDER BY charttime, storetime) AS prev_valuenum,
      lag(value) OVER (PARTITION BY stay_id, itemid ORDER BY charttime, storetime) AS prev_value,
      lag(charttime) OVER (PARTITION BY stay_id, itemid ORDER BY charttime, storetime) AS prev_charttime
    FROM read_parquet('{esc(vent_path)}')
    WHERE itemid IN ({','.join(map(str, transition_ids))})
  )
  SELECT subject_id, hadm_id, stay_id, charttime AS transition_time, itemid,
         prev_charttime, prev_valuenum, valuenum, prev_value, value, valueuom
  FROM x
  WHERE prev_charttime IS NOT NULL
    AND (
      (valuenum IS NOT NULL AND prev_valuenum IS NOT NULL AND valuenum <> prev_valuenum)
      OR
      (valuenum IS NULL AND prev_valuenum IS NULL
       AND coalesce(value,'') <> coalesce(prev_value,''))
    )
) TO '{esc(trans_path)}' (FORMAT PARQUET, COMPRESSION ZSTD);
""")

print("Wrote:", adult_path)
print("Wrote:", vent_path)
print("Wrote:", lab_path)
print("Wrote:", trans_path)
print("Adult ICU stays:", con.execute(f"SELECT count(*) FROM read_parquet('{esc(adult_path)}')").fetchone()[0])
print("Candidate transitions:", con.execute(f"SELECT count(*) FROM read_parquet('{esc(trans_path)}')").fetchone()[0])
