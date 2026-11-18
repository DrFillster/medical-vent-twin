#!/usr/bin/env python3
from pathlib import Path
import duckdb

RAW=Path("/Users/philipbernard/mimic-data/raw/mimiciv/3.1/mimiciv-3.1")
DER=Path("/Users/philipbernard/mimic-data/derived")
STRICT=DER/"pilot_strict_pool.parquet"
INPUT=RAW/"icu/inputevents.csv.gz"
OUT=DER/"pilot_strict_pool_confounded.parquet"
SAMPLE=DER/"pilot_review_sample_strict_100.parquet"

vaso=(221289,221653,221662,221749,221906,222315,229617,229630,229631,229632)
sed=(221668,221712,221744,222168,225150,225154,225942,225972,229420)

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("PRAGMA memory_limit='4GB'")
con.execute("PRAGMA temp_directory='/Users/philipbernard/mimic-data/tmp'")

con.execute(f"""
COPY (
WITH x AS (
 SELECT p.*,
   EXISTS (
     SELECT 1 FROM read_csv_auto('{INPUT}', header=true, sample_size=200000) i
     WHERE i.stay_id=p.stay_id
       AND i.itemid IN {vaso}
       AND i.starttime BETWEEN p.transition_time-INTERVAL '60 minutes' AND p.transition_time+INTERVAL '60 minutes'
   ) vaso_nearby,
   EXISTS (
     SELECT 1 FROM read_csv_auto('{INPUT}', header=true, sample_size=200000) i
     WHERE i.stay_id=p.stay_id
       AND i.itemid IN {sed}
       AND i.starttime BETWEEN p.transition_time-INTERVAL '60 minutes' AND p.transition_time+INTERVAL '60 minutes'
   ) sedative_nearby
 FROM read_parquet('{STRICT}') p
)
SELECT * FROM x
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

con.execute(f"""
COPY (
WITH ranked AS (
 SELECT *,
   row_number() OVER (
     PARTITION BY itemid
     ORDER BY
       CASE WHEN vaso_nearby OR sedative_nearby THEN 1 ELSE 0 END,
       hash(stay_id,transition_time,itemid)
   ) rn
 FROM read_parquet('{OUT}')
)
SELECT * FROM ranked WHERE rn<=25
) TO '{SAMPLE}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("strict_total", con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
print("no_vaso_sed", con.execute(f"select count(*) from read_parquet('{OUT}') where not vaso_nearby and not sedative_nearby").fetchone()[0])
print("vaso", con.execute(f"select count(*) from read_parquet('{OUT}') where vaso_nearby").fetchone()[0])
print("sedative", con.execute(f"select count(*) from read_parquet('{OUT}') where sedative_nearby").fetchone()[0])
print("both", con.execute(f"select count(*) from read_parquet('{OUT}') where vaso_nearby and sedative_nearby").fetchone()[0])
print("sample", con.execute(f"select count(*) from read_parquet('{SAMPLE}')").fetchone()[0])
for r in con.execute(f"select itemid,count(*) n,count(*) filter(where not vaso_nearby and not sedative_nearby) clean from read_parquet('{SAMPLE}') group by itemid order by itemid").fetchall():
    print("sample_item", *r)
