#!/usr/bin/env python3
from pathlib import Path
import duckdb

RAW=Path("/Users/philipbernard/mimic-data/raw/mimiciv/3.1/mimiciv-3.1")
DER=Path("/Users/philipbernard/mimic-data/derived")
POOL=DER/"pilot_invasive_clean_pool.parquet"
PROC=RAW/"icu/procedureevents.csv.gz"
VENT=DER/"vent_chart_events.parquet"
OUT=DER/"pilot_invasive_screened_pool.parquet"
SAMPLE=DER/"pilot_final_review_sample_100.parquet"

proc_items=(224385,225400,225433,225448,225468,225477,226237,227194,227712,229529,229530)
chart_items=(224660,224710,224711,224712,224715,224716,224717,229270,229278,229280)

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("PRAGMA memory_limit='4GB'")
con.execute("PRAGMA temp_directory='/Users/philipbernard/mimic-data/tmp'")

con.execute(f"""
COPY (
WITH x AS (
 SELECT p.*,
  EXISTS (
   SELECT 1 FROM read_csv_auto('{PROC}',header=true,sample_size=200000) q
   WHERE q.stay_id=p.stay_id AND q.itemid IN {proc_items}
     AND q.starttime BETWEEN p.transition_time-INTERVAL '2 hours' AND p.transition_time+INTERVAL '2 hours'
  ) airway_or_procedure_2h,
  EXISTS (
   SELECT 1 FROM read_parquet('{VENT}') v
   WHERE v.stay_id=p.stay_id AND v.itemid IN {chart_items}
     AND v.charttime BETWEEN p.transition_time-INTERVAL '2 hours' AND p.transition_time+INTERVAL '2 hours'
  ) recruitment_sbt_ecmo_2h,
  EXISTS (
   SELECT 1 FROM read_parquet('{VENT}') v
   WHERE v.stay_id=p.stay_id AND v.itemid IN (224660,229270,229278,229280)
     AND v.charttime BETWEEN p.transition_time-INTERVAL '6 hours' AND p.transition_time+INTERVAL '6 hours'
  ) ecmo_context_6h
 FROM read_parquet('{POOL}') p
)
SELECT * FROM x
WHERE NOT airway_or_procedure_2h
  AND NOT recruitment_sbt_ecmo_2h
  AND NOT ecmo_context_6h
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

con.execute(f"""
COPY (
WITH r AS (
 SELECT *, row_number() over(
   partition by itemid order by hash(stay_id,transition_time,itemid)
 ) rn
 FROM read_parquet('{OUT}')
)
SELECT * FROM r WHERE rn<=25
) TO '{SAMPLE}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("screened_pool",con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
print("screened_stays",con.execute(f"select count(distinct stay_id) from read_parquet('{OUT}')").fetchone()[0])
for r in con.execute(f"select itemid,count(*) n,count(distinct stay_id) stays from read_parquet('{OUT}') group by itemid order by itemid").fetchall():
    print("pool_item",*r)
print("sample",con.execute(f"select count(*) from read_parquet('{SAMPLE}')").fetchone()[0])
for r in con.execute(f"select itemid,count(*) n from read_parquet('{SAMPLE}') group by itemid order by itemid").fetchall():
    print("sample_item",*r)
