#!/usr/bin/env python3
from pathlib import Path
import duckdb

RAW=Path("/Users/philipbernard/mimic-data/raw/mimiciv/3.1/mimiciv-3.1")
DER=Path("/Users/philipbernard/mimic-data/derived")
SAMPLE=DER/"pilot_final_review_sample_100.parquet"
PROC=RAW/"icu/procedureevents.csv.gz"
VENT=DER/"vent_chart_events.parquet"
OUT=DER/"pilot_review_procedure_flags_100.parquet"

proc_items=(224385,225400,225433,225448,225468,225477,226237,227194,227712,229529,229530)
chart_items=(224660,224710,224711,224712,224715,224716,224717,229270,229278,229280)

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("PRAGMA memory_limit='4GB'")
con.execute(f"""
COPY (
WITH s AS (
 SELECT *,
   printf('EVT-%03d', row_number() over(order by itemid,transition_time,stay_id)) event_id
 FROM read_parquet('{SAMPLE}')
)
SELECT s.event_id,s.itemid,s.transition_time,
  EXISTS (
   SELECT 1 FROM read_csv_auto('{PROC}',header=true,sample_size=200000) p
   WHERE p.stay_id=s.stay_id AND p.itemid IN {proc_items}
     AND p.starttime BETWEEN s.transition_time-INTERVAL '2 hours' AND s.transition_time+INTERVAL '2 hours'
  ) airway_or_procedure_2h,
  EXISTS (
   SELECT 1 FROM read_parquet('{VENT}') v
   WHERE v.stay_id=s.stay_id AND v.itemid IN {chart_items}
     AND v.charttime BETWEEN s.transition_time-INTERVAL '2 hours' AND s.transition_time+INTERVAL '2 hours'
  ) recruitment_sbt_ecmo_2h,
  EXISTS (
   SELECT 1 FROM read_parquet('{VENT}') v
   WHERE v.stay_id=s.stay_id AND v.itemid IN (224660,229270,229278,229280)
     AND v.charttime BETWEEN s.transition_time-INTERVAL '6 hours' AND s.transition_time+INTERVAL '6 hours'
  ) ecmo_context_6h
FROM s
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")
print("procedure_2h",con.execute(f"select count(*) from read_parquet('{OUT}') where airway_or_procedure_2h").fetchone()[0])
print("recruitment_sbt_ecmo_2h",con.execute(f"select count(*) from read_parquet('{OUT}') where recruitment_sbt_ecmo_2h").fetchone()[0])
print("ecmo_6h",con.execute(f"select count(*) from read_parquet('{OUT}') where ecmo_context_6h").fetchone()[0])
print("none",con.execute(f"""
select count(*) from read_parquet('{OUT}')
where not airway_or_procedure_2h and not recruitment_sbt_ecmo_2h and not ecmo_context_6h
""").fetchone()[0])
