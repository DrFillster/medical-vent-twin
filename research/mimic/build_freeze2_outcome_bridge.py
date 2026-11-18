#!/usr/bin/env python3
from pathlib import Path
import duckdb, json

DER=Path("/Users/philipbernard/mimic-data/derived")
F2=DER/"freeze2_event_index.jsonl"
IDX=DER/"fit_event_index.parquet"
ABG=DER/"arterial_blood_gases.parquet"
VENT=DER/"vent_chart_events.parquet"
PHENO=DER/"phenotype_inputs.parquet"
OUT=DER/"freeze2_outcome_bridge.parquet"

event_ids=[]
for line in F2.read_text().splitlines():
    if line.strip(): event_ids.append(json.loads(line)["event_id"])
if len(event_ids)!=81 or len(set(event_ids))!=81:
    raise RuntimeError(f"expected 81 unique Freeze 2 event IDs, got {len(event_ids)}")

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("CREATE TEMP TABLE f2_ids(event_id VARCHAR)")
con.executemany("INSERT INTO f2_ids VALUES (?)",[(x,) for x in event_ids])

con.execute(f"""
COPY (
WITH eligible AS (
 SELECT i.*
 FROM read_parquet('{IDX}') i
 JOIN f2_ids f USING(event_id)
),
base AS (
 SELECT e.*,
   p.pre_ph,p.pre_pco2,p.pre_po2,p.pre_spo2,p.pre_hr,p.pre_map
 FROM eligible e
 LEFT JOIN read_parquet('{PHENO}') p
   ON p.stay_id=e.stay_id AND p.transition_time=e.transition_time
),
gas AS (
 SELECT b.*,
   a.charttime post_abg_time,
   a.ph post_ph,a.pco2 post_pco2,a.po2 post_po2
 FROM base b
 LEFT JOIN LATERAL (
   SELECT *
   FROM read_parquet('{ABG}') a
   WHERE a.hadm_id=b.hadm_id
     AND a.charttime >= b.transition_time + INTERVAL '5 minutes'
     AND a.charttime <= b.transition_time + INTERVAL '180 minutes'
     AND a.ph IS NOT NULL AND a.pco2 IS NOT NULL AND a.po2 IS NOT NULL
   ORDER BY a.charttime ASC
   LIMIT 1
 ) a ON true
),
vitals AS (
 SELECT g.*,
   hr15.valuenum post_hr_15, hr30.valuenum post_hr_30, hr60.valuenum post_hr_60,
   map15.valuenum post_map_15,map30.valuenum post_map_30,map60.valuenum post_map_60,
   sp15.valuenum post_spo2_15,sp30.valuenum post_spo2_30,sp60.valuenum post_spo2_60
 FROM gas g
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=g.stay_id AND v.itemid=220045
     AND v.charttime BETWEEN g.transition_time+INTERVAL '5 minutes' AND g.transition_time+INTERVAL '25 minutes'
     AND v.valuenum BETWEEN 20 AND 250
   ORDER BY abs(date_diff('second',v.charttime,g.transition_time+INTERVAL '15 minutes')) LIMIT 1
 ) hr15 ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=g.stay_id AND v.itemid=220045
     AND v.charttime BETWEEN g.transition_time+INTERVAL '20 minutes' AND g.transition_time+INTERVAL '40 minutes'
     AND v.valuenum BETWEEN 20 AND 250
   ORDER BY abs(date_diff('second',v.charttime,g.transition_time+INTERVAL '30 minutes')) LIMIT 1
 ) hr30 ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=g.stay_id AND v.itemid=220045
     AND v.charttime BETWEEN g.transition_time+INTERVAL '50 minutes' AND g.transition_time+INTERVAL '70 minutes'
     AND v.valuenum BETWEEN 20 AND 250
   ORDER BY abs(date_diff('second',v.charttime,g.transition_time+INTERVAL '60 minutes')) LIMIT 1
 ) hr60 ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=g.stay_id AND v.itemid=220052
     AND v.charttime BETWEEN g.transition_time+INTERVAL '5 minutes' AND g.transition_time+INTERVAL '25 minutes'
     AND v.valuenum BETWEEN 20 AND 200
   ORDER BY abs(date_diff('second',v.charttime,g.transition_time+INTERVAL '15 minutes')) LIMIT 1
 ) map15 ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=g.stay_id AND v.itemid=220052
     AND v.charttime BETWEEN g.transition_time+INTERVAL '20 minutes' AND g.transition_time+INTERVAL '40 minutes'
     AND v.valuenum BETWEEN 20 AND 200
   ORDER BY abs(date_diff('second',v.charttime,g.transition_time+INTERVAL '30 minutes')) LIMIT 1
 ) map30 ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=g.stay_id AND v.itemid=220052
     AND v.charttime BETWEEN g.transition_time+INTERVAL '50 minutes' AND g.transition_time+INTERVAL '70 minutes'
     AND v.valuenum BETWEEN 20 AND 200
   ORDER BY abs(date_diff('second',v.charttime,g.transition_time+INTERVAL '60 minutes')) LIMIT 1
 ) map60 ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=g.stay_id AND v.itemid=220277
     AND v.charttime BETWEEN g.transition_time+INTERVAL '5 minutes' AND g.transition_time+INTERVAL '25 minutes'
     AND v.valuenum BETWEEN 50 AND 100
   ORDER BY abs(date_diff('second',v.charttime,g.transition_time+INTERVAL '15 minutes')) LIMIT 1
 ) sp15 ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=g.stay_id AND v.itemid=220277
     AND v.charttime BETWEEN g.transition_time+INTERVAL '20 minutes' AND g.transition_time+INTERVAL '40 minutes'
     AND v.valuenum BETWEEN 50 AND 100
   ORDER BY abs(date_diff('second',v.charttime,g.transition_time+INTERVAL '30 minutes')) LIMIT 1
 ) sp30 ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=g.stay_id AND v.itemid=220277
     AND v.charttime BETWEEN g.transition_time+INTERVAL '50 minutes' AND g.transition_time+INTERVAL '70 minutes'
     AND v.valuenum BETWEEN 50 AND 100
   ORDER BY abs(date_diff('second',v.charttime,g.transition_time+INTERVAL '60 minutes')) LIMIT 1
 ) sp60 ON true
)
SELECT *,
  date_diff('second',transition_time,post_abg_time)/60.0 post_abg_minutes
FROM vitals
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("rows",con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
print("gas_complete",con.execute(f"select count(*) from read_parquet('{OUT}') where post_abg_time is not null").fetchone()[0])
for h in (15,30,60):
    print("horizon",h,
      "hr",con.execute(f"select count(*) from read_parquet('{OUT}') where post_hr_{h} is not null").fetchone()[0],
      "map",con.execute(f"select count(*) from read_parquet('{OUT}') where post_map_{h} is not null").fetchone()[0],
      "spo2",con.execute(f"select count(*) from read_parquet('{OUT}') where post_spo2_{h} is not null").fetchone()[0])
