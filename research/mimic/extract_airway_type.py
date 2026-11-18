#!/usr/bin/env python3
from pathlib import Path
import duckdb

RAW=Path("/Users/philipbernard/mimic-data/raw/mimiciv/3.1/mimiciv-3.1")
DER=Path("/Users/philipbernard/mimic-data/derived")
src=RAW/"icu/chartevents.csv.gz"
out=DER/"airway_type_events.parquet"

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("PRAGMA memory_limit='4GB'")
con.execute("PRAGMA temp_directory='/Users/philipbernard/mimic-data/tmp'")
con.execute(f"""
COPY (
 SELECT subject_id,hadm_id,stay_id,caregiver_id,charttime,storetime,itemid,value
 FROM read_csv_auto('{src}',header=true,sample_size=200000)
 WHERE itemid=223836
) TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")
print("airway_rows",con.execute(f"select count(*) from read_parquet('{out}')").fetchone()[0])
for r in con.execute(f"select value,count(*) n from read_parquet('{out}') group by value order by n desc").fetchall():
    print(r)
