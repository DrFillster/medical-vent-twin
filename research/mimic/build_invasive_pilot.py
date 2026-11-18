#!/usr/bin/env python3
from pathlib import Path
import duckdb

DER=Path("/Users/philipbernard/mimic-data/derived")
P=DER/"pilot_strict_pool_full_confounders.parquet"
VD=DER/"mimic_ventilation_status.parquet"
OUT=DER/"pilot_invasive_clean_pool.parquet"
SAMPLE=DER/"pilot_invasive_review_sample_100.parquet"

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute(f"""
COPY (
WITH e AS (
 SELECT *
 FROM read_parquet('{P}')
 WHERE not vaso_active and not sedative_active
   and not vaso_start_60m and not sedative_start_60m
)
SELECT e.*
FROM e
JOIN read_parquet('{VD}') v
  ON v.stay_id=e.stay_id
 AND e.transition_time BETWEEN v.starttime AND v.endtime
WHERE v.ventilation_status='InvasiveVent'
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

con.execute(f"""
COPY (
WITH r AS (
 SELECT *,
   row_number() over(
     partition by itemid
     order by hash(stay_id,transition_time,itemid)
   ) rn
 FROM read_parquet('{OUT}')
)
SELECT * FROM r WHERE rn<=25
) TO '{SAMPLE}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("invasive_clean",con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
print("stays",con.execute(f"select count(distinct stay_id) from read_parquet('{OUT}')").fetchone()[0])
for r in con.execute(f"select itemid,count(*) n,count(distinct stay_id) stays from read_parquet('{OUT}') group by itemid order by itemid").fetchall():
    print("pool_item",*r)
print("sample",con.execute(f"select count(*) from read_parquet('{SAMPLE}')").fetchone()[0])
for r in con.execute(f"select itemid,count(*) n from read_parquet('{SAMPLE}') group by itemid order by itemid").fetchall():
    print("sample_item",*r)
