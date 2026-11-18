#!/usr/bin/env python3
from pathlib import Path
import duckdb

DER = Path("/Users/philipbernard/mimic-data/derived")
vent = DER / "vent_chart_events.parquet"
lab = DER / "blood_gas_events.parquet"
clean = DER / "ventilator_transitions_clean.parquet"
abg = DER / "arterial_blood_gases.parquet"

con = duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("PRAGMA memory_limit='4GB'")
con.execute("PRAGMA temp_directory='/Users/philipbernard/mimic-data/tmp'")

# Pilot thresholds are data-cleaning / material-change thresholds, not final clinical cutoffs.
# FiO2 is normalized to percent.
con.execute(f"""
COPY (
WITH normalized AS (
  SELECT subject_id, hadm_id, stay_id, charttime, storetime, itemid, value, valueuom,
    CASE
      WHEN itemid=223835 AND valuenum BETWEEN 0.21 AND 1.0 THEN valuenum*100.0
      ELSE valuenum
    END AS x
  FROM read_parquet('{vent}')
  WHERE
    (itemid=223835 AND (valuenum BETWEEN 0.21 AND 1.0 OR valuenum BETWEEN 21 AND 100))
    OR (itemid=220339 AND valuenum BETWEEN 0 AND 30)
    OR (itemid=224688 AND valuenum BETWEEN 4 AND 60)
    OR (itemid=224684 AND valuenum BETWEEN 100 AND 1000)
    OR (itemid IN (224701,224702,227187,229663) AND valuenum BETWEEN 0 AND 60)
    OR itemid IN (223849,229314)
),
lagged AS (
  SELECT *,
    lag(x) OVER (PARTITION BY stay_id,itemid ORDER BY charttime,storetime) prev_x,
    lag(value) OVER (PARTITION BY stay_id,itemid ORDER BY charttime,storetime) prev_value,
    lag(charttime) OVER (PARTITION BY stay_id,itemid ORDER BY charttime,storetime) prev_charttime
  FROM normalized
),
changes AS (
  SELECT *,
    CASE itemid
      WHEN 223835 THEN abs(x-prev_x) >= 10
      WHEN 220339 THEN abs(x-prev_x) >= 2
      WHEN 224688 THEN abs(x-prev_x) >= 2
      WHEN 224684 THEN abs(x-prev_x) >= 50
      WHEN 224701 THEN abs(x-prev_x) >= 2
      WHEN 224702 THEN abs(x-prev_x) >= 2
      WHEN 227187 THEN abs(x-prev_x) >= 2
      WHEN 229663 THEN abs(x-prev_x) >= 2
      WHEN 223849 THEN coalesce(value,'') <> coalesce(prev_value,'')
      WHEN 229314 THEN coalesce(value,'') <> coalesce(prev_value,'')
      ELSE false
    END material_change
  FROM lagged
)
SELECT subject_id, hadm_id, stay_id, charttime transition_time, itemid,
       prev_charttime, prev_x, x new_x, prev_value, value new_value, valueuom
FROM changes
WHERE prev_charttime IS NOT NULL AND material_change
) TO '{clean}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

# Pair blood gas analytes to the specimen-type row using specimen_id.
con.execute(f"""
COPY (
WITH bg AS (
  SELECT * FROM read_parquet('{lab}')
),
art AS (
  SELECT DISTINCT specimen_id
  FROM bg
  WHERE itemid=52033 AND upper(trim(value))='ART.'
),
pivoted AS (
  SELECT b.subject_id, b.hadm_id, b.specimen_id,
         min(b.charttime) charttime,
         max(CASE WHEN itemid=50820 THEN valuenum END) ph,
         max(CASE WHEN itemid=50818 THEN valuenum END) pco2,
         max(CASE WHEN itemid=50821 THEN valuenum END) po2,
         max(CASE WHEN itemid=50803 THEN valuenum END) bicarbonate,
         max(CASE WHEN itemid=50802 THEN valuenum END) base_excess,
         max(CASE WHEN itemid=50813 THEN valuenum END) lactate
  FROM bg b
  JOIN art USING(specimen_id)
  GROUP BY b.subject_id,b.hadm_id,b.specimen_id
)
SELECT * FROM pivoted
WHERE ph IS NOT NULL OR pco2 IS NOT NULL OR po2 IS NOT NULL
) TO '{abg}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("clean_transitions", con.execute(f"select count(*) from read_parquet('{clean}')").fetchone()[0])
print("transition_stays", con.execute(f"select count(distinct stay_id) from read_parquet('{clean}')").fetchone()[0])
print("arterial_blood_gases", con.execute(f"select count(*) from read_parquet('{abg}')").fetchone()[0])
print("abg_subjects", con.execute(f"select count(distinct subject_id) from read_parquet('{abg}')").fetchone()[0])
