#!/usr/bin/env python3
from pathlib import Path
import duckdb

DER=Path("/Users/philipbernard/mimic-data/derived")
IDX=DER/"fit_event_index.parquet"
FROZEN=DER/"frozen_phenotypes.parquet"
ABG=DER/"arterial_blood_gases.parquet"
VENT=DER/"vent_chart_events.parquet"
PHENO=DER/"phenotype_inputs.parquet"
OUT=DER/"outcome_bridge_frozen136.parquet"

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("PRAGMA memory_limit='4GB'")

con.execute(f"""
COPY (
WITH eligible AS (
 SELECT
   f.event_id,
   i.subject_id,i.hadm_id,i.stay_id,i.transition_time,
   i.transition_itemid,i.hummod_mode,
   i.transition_pre_value,i.transition_post_value
 FROM read_parquet('{FROZEN}') f
 JOIN read_parquet('{IDX}') i USING(event_id)
 WHERE f.representability='well-represented'
   AND (
     i.transition_itemid IN (223835,220339)
     OR (i.transition_itemid=224688 AND i.hummod_mode IN ('VC_AC','PC_AC'))
     OR (i.transition_itemid=224684 AND i.hummod_mode='VC_AC')
   )
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
   hr15.charttime hr15_time,hr15.valuenum post_hr_15,
   hr30.charttime hr30_time,hr30.valuenum post_hr_30,
   hr60.charttime hr60_time,hr60.valuenum post_hr_60,
   map15.charttime map15_time,map15.valuenum post_map_15,
   map30.charttime map30_time,map30.valuenum post_map_30,
   map60.charttime map60_time,map60.valuenum post_map_60,
   sp15.charttime spo2_15_time,sp15.valuenum post_spo2_15,
   sp30.charttime spo2_30_time,sp30.valuenum post_spo2_30,
   sp60.charttime spo2_60_time,sp60.valuenum post_spo2_60
 FROM gas g

 LEFT JOIN LATERAL (
   SELECT charttime,valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=g.stay_id AND v.itemid=220045
     AND v.charttime BETWEEN g.transition_time+INTERVAL '5 minutes'
                         AND g.transition_time+INTERVAL '25 minutes'
     AND v.valuenum BETWEEN 20 AND 250
   ORDER BY abs(date_diff('second',v.charttime,g.transition_time+INTERVAL '15 minutes')) LIMIT 1
 ) hr15 ON true
 LEFT JOIN LATERAL (
   SELECT charttime,valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=g.stay_id AND v.itemid=220045
     AND v.charttime BETWEEN g.transition_time+INTERVAL '20 minutes'
                         AND g.transition_time+INTERVAL '40 minutes'
     AND v.valuenum BETWEEN 20 AND 250
   ORDER BY abs(date_diff('second',v.charttime,g.transition_time+INTERVAL '30 minutes')) LIMIT 1
 ) hr30 ON true
 LEFT JOIN LATERAL (
   SELECT charttime,valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=g.stay_id AND v.itemid=220045
     AND v.charttime BETWEEN g.transition_time+INTERVAL '50 minutes'
                         AND g.transition_time+INTERVAL '70 minutes'
     AND v.valuenum BETWEEN 20 AND 250
   ORDER BY abs(date_diff('second',v.charttime,g.transition_time+INTERVAL '60 minutes')) LIMIT 1
 ) hr60 ON true

 LEFT JOIN LATERAL (
   SELECT charttime,valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=g.stay_id AND v.itemid=220052
     AND v.charttime BETWEEN g.transition_time+INTERVAL '5 minutes'
                         AND g.transition_time+INTERVAL '25 minutes'
     AND v.valuenum BETWEEN 20 AND 200
   ORDER BY abs(date_diff('second',v.charttime,g.transition_time+INTERVAL '15 minutes')) LIMIT 1
 ) map15 ON true
 LEFT JOIN LATERAL (
   SELECT charttime,valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=g.stay_id AND v.itemid=220052
     AND v.charttime BETWEEN g.transition_time+INTERVAL '20 minutes'
                         AND g.transition_time+INTERVAL '40 minutes'
     AND v.valuenum BETWEEN 20 AND 200
   ORDER BY abs(date_diff('second',v.charttime,g.transition_time+INTERVAL '30 minutes')) LIMIT 1
 ) map30 ON true
 LEFT JOIN LATERAL (
   SELECT charttime,valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=g.stay_id AND v.itemid=220052
     AND v.charttime BETWEEN g.transition_time+INTERVAL '50 minutes'
                         AND g.transition_time+INTERVAL '70 minutes'
     AND v.valuenum BETWEEN 20 AND 200
   ORDER BY abs(date_diff('second',v.charttime,g.transition_time+INTERVAL '60 minutes')) LIMIT 1
 ) map60 ON true

 LEFT JOIN LATERAL (
   SELECT charttime,valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=g.stay_id AND v.itemid=220277
     AND v.charttime BETWEEN g.transition_time+INTERVAL '5 minutes'
                         AND g.transition_time+INTERVAL '25 minutes'
     AND v.valuenum BETWEEN 50 AND 100
   ORDER BY abs(date_diff('second',v.charttime,g.transition_time+INTERVAL '15 minutes')) LIMIT 1
 ) sp15 ON true
 LEFT JOIN LATERAL (
   SELECT charttime,valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=g.stay_id AND v.itemid=220277
     AND v.charttime BETWEEN g.transition_time+INTERVAL '20 minutes'
                         AND g.transition_time+INTERVAL '40 minutes'
     AND v.valuenum BETWEEN 50 AND 100
   ORDER BY abs(date_diff('second',v.charttime,g.transition_time+INTERVAL '30 minutes')) LIMIT 1
 ) sp30 ON true
 LEFT JOIN LATERAL (
   SELECT charttime,valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=g.stay_id AND v.itemid=220277
     AND v.charttime BETWEEN g.transition_time+INTERVAL '50 minutes'
                         AND g.transition_time+INTERVAL '70 minutes'
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
