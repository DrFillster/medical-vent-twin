#!/usr/bin/env python3
from pathlib import Path
import duckdb

DER=Path("/Users/philipbernard/mimic-data/derived")
SRC=DER/"pilot_supported_mode_pool.parquet"
OUT60=DER/"pilot_primary_60min_pool.parquet"
OUT30=DER/"pilot_sensitivity_30min_pool.parquet"

con=duckdb.connect()
con.execute(f"""
COPY (
  SELECT *
  FROM read_parquet('{SRC}')
  WHERE post_abg_minutes<=60
    AND competing_60m=0
) TO '{OUT60}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")
con.execute(f"""
COPY (
  SELECT *
  FROM read_parquet('{SRC}')
  WHERE post_abg_minutes<=30
    AND competing_60m=0
) TO '{OUT30}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("primary60",con.execute(f"select count(*) from read_parquet('{OUT60}')").fetchone()[0])
print("primary60_stays",con.execute(f"select count(distinct stay_id) from read_parquet('{OUT60}')").fetchone()[0])
for r in con.execute(f"""
select hummod_mode,itemid,count(*) n,count(distinct stay_id) stays
from read_parquet('{OUT60}')
group by 1,2 order by 1,2
""").fetchall(): print("60",*r)

print("sensitivity30",con.execute(f"select count(*) from read_parquet('{OUT30}')").fetchone()[0])
print("sensitivity30_stays",con.execute(f"select count(distinct stay_id) from read_parquet('{OUT30}')").fetchone()[0])
for r in con.execute(f"""
select hummod_mode,itemid,count(*) n,count(distinct stay_id) stays
from read_parquet('{OUT30}')
group by 1,2 order by 1,2
""").fetchall(): print("30",*r)
