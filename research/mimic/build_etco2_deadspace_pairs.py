#!/usr/bin/env python3
from pathlib import Path
import duckdb

DER=Path("/Users/philipbernard/mimic-data/derived")
PHENO=DER/"phenotype_inputs.parquet"
VENT=DER/"vent_chart_events.parquet"
ABG=DER/"arterial_blood_gases.parquet"
OUT=DER/"deadspace_etco2_pairs.parquet"

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("PRAGMA memory_limit='4GB'")

con.execute(f"""
COPY (
WITH e AS (
 SELECT *
 FROM read_parquet('{PHENO}')
),
paired AS (
 SELECT
   e.subject_id,e.hadm_id,e.stay_id,e.transition_time,e.transition_itemid,
   e.hummod_mode,e.identifiability_grade,
   a.charttime abg_time,
   a.pco2 paco2,
   et.charttime etco2_time,
   et.valuenum petco2,
   abs(date_diff('minute',a.charttime,et.charttime)) pair_minutes,
   date_diff('minute',a.charttime,e.transition_time) abg_to_transition_minutes
 FROM e
 JOIN LATERAL (
   SELECT *
   FROM read_parquet('{ABG}') a
   WHERE a.hadm_id=e.hadm_id
     AND a.charttime BETWEEN e.transition_time-INTERVAL '4 hours' AND e.transition_time
     AND a.pco2 IS NOT NULL
   ORDER BY a.charttime DESC
   LIMIT 1
 ) a ON true
 JOIN LATERAL (
   SELECT *
   FROM read_parquet('{VENT}') et
   WHERE et.stay_id=e.stay_id
     AND et.itemid=228640
     AND et.valuenum IS NOT NULL
     AND et.valuenum BETWEEN 5 AND 100
     AND et.charttime BETWEEN a.charttime-INTERVAL '30 minutes' AND a.charttime+INTERVAL '30 minutes'
     AND et.charttime <= e.transition_time
   ORDER BY abs(date_diff('second',a.charttime,et.charttime))
   LIMIT 1
 ) et ON true
)
SELECT *,
  CASE
    WHEN paco2>0 THEN (paco2-petco2)/paco2
    ELSE NULL
  END paco2_petco2_fraction,
  CASE
    WHEN paco2>0 THEN petco2/paco2
    ELSE NULL
  END petco2_paco2_ratio
FROM paired
WHERE paco2 BETWEEN 10 AND 150
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("pairs",con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
print("stays",con.execute(f"select count(distinct stay_id) from read_parquet('{OUT}')").fetchone()[0])
print("within_10m",con.execute(f"select count(*) from read_parquet('{OUT}') where pair_minutes<=10").fetchone()[0])
print("within_15m",con.execute(f"select count(*) from read_parquet('{OUT}') where pair_minutes<=15").fetchone()[0])
print("nonnegative",con.execute(f"select count(*) from read_parquet('{OUT}') where paco2_petco2_fraction between 0 and 1").fetchone()[0])
print("negative",con.execute(f"select count(*) from read_parquet('{OUT}') where paco2_petco2_fraction<0").fetchone()[0])
print("q",con.execute(f"""
select approx_quantile(paco2_petco2_fraction,[0.05,0.1,0.25,0.5,0.75,0.9,0.95])
from read_parquet('{OUT}')
where paco2_petco2_fraction between 0 and 1
""").fetchone()[0])
for r in con.execute(f"""
select hummod_mode,count(*) n,count(*) filter(where pair_minutes<=15) within15
from read_parquet('{OUT}')
group by 1 order by n desc
""").fetchall():
    print("mode",*r)
