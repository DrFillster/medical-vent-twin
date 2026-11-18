#!/usr/bin/env python3
from pathlib import Path
import duckdb

RAW=Path("/Users/philipbernard/mimic-data/raw/mimiciv/3.1/mimiciv-3.1")
DER=Path("/Users/philipbernard/mimic-data/derived")
src=RAW/"icu/chartevents.csv.gz"
out=DER/"vent_timing_flow_events.parquet"

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("PRAGMA memory_limit='4GB'")
con.execute("PRAGMA temp_directory='/Users/philipbernard/mimic-data/tmp'")
con.execute(f"""
COPY (
 SELECT subject_id,hadm_id,stay_id,caregiver_id,charttime,storetime,itemid,
        value,valuenum,valueuom
 FROM read_csv_auto('{src}',header=true,sample_size=200000)
 WHERE itemid IN (224691,224738,226873)
) TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")
print("rows",con.execute(f"select count(*) from read_parquet('{out}')").fetchone()[0])
for r in con.execute(f"select itemid,count(*) n,count(distinct stay_id) stays from read_parquet('{out}') group by itemid order by itemid").fetchall():
    print(r)
