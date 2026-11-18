#!/usr/bin/env python3
from pathlib import Path
import duckdb

RAW=Path("/Users/philipbernard/mimic-data/raw/mimiciv/3.1/mimiciv-3.1")
DER=Path("/Users/philipbernard/mimic-data/derived")
STRICT=DER/"pilot_strict_pool.parquet"
INPUT=RAW/"icu/inputevents.csv.gz"
OUT=DER/"pilot_strict_pool_full_confounders.parquet"
SAMPLE=DER/"pilot_review_sample_strict_clean_100.parquet"

vaso=(221289,221653,221662,221749,221906,222315,229617,229630,229631,229632)
sed=(221668,221712,221744,222168,225150,225154,225942,225972,229420)

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("PRAGMA memory_limit='4GB'")
con.execute("PRAGMA temp_directory='/Users/philipbernard/mimic-data/tmp'")

con.execute(f"""
COPY (
WITH p AS (
 SELECT * FROM read_parquet('{STRICT}')
),
m AS (
 SELECT p.stay_id,p.transition_time,i.itemid,i.starttime,i.endtime,
        CASE WHEN i.itemid IN {vaso} THEN 'vasoactive' ELSE 'sedative_analgesic' END med_class
 FROM p
 JOIN read_csv_auto('{INPUT}',header=true,sample_size=200000) i
   ON i.stay_id=p.stay_id
  AND i.itemid IN {tuple(sorted(set(vaso+sed)))}
  AND i.starttime <= p.transition_time+INTERVAL '60 minutes'
  AND coalesce(i.endtime,i.starttime) >= p.transition_time-INTERVAL '60 minutes'
)
SELECT p.*,
  EXISTS(SELECT 1 FROM m WHERE m.stay_id=p.stay_id AND m.transition_time=p.transition_time AND med_class='vasoactive'
         AND starttime<=p.transition_time AND coalesce(endtime,starttime)>=p.transition_time) vaso_active,
  EXISTS(SELECT 1 FROM m WHERE m.stay_id=p.stay_id AND m.transition_time=p.transition_time AND med_class='sedative_analgesic'
         AND starttime<=p.transition_time AND coalesce(endtime,starttime)>=p.transition_time) sedative_active,
  EXISTS(SELECT 1 FROM m WHERE m.stay_id=p.stay_id AND m.transition_time=p.transition_time AND med_class='vasoactive'
         AND starttime BETWEEN p.transition_time-INTERVAL '60 minutes' AND p.transition_time+INTERVAL '60 minutes') vaso_start_60m,
  EXISTS(SELECT 1 FROM m WHERE m.stay_id=p.stay_id AND m.transition_time=p.transition_time AND med_class='sedative_analgesic'
         AND starttime BETWEEN p.transition_time-INTERVAL '60 minutes' AND p.transition_time+INTERVAL '60 minutes') sedative_start_60m
FROM p
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

con.execute(f"""
COPY (
WITH eligible AS (
 SELECT * FROM read_parquet('{OUT}')
 WHERE NOT vaso_active AND NOT sedative_active
   AND NOT vaso_start_60m AND NOT sedative_start_60m
),
ranked AS (
 SELECT *, row_number() OVER (
   PARTITION BY itemid ORDER BY hash(stay_id,transition_time,itemid)
 ) rn
 FROM eligible
)
SELECT * FROM ranked WHERE rn<=25
) TO '{SAMPLE}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("strict_total",con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
print("fully_unconfounded",con.execute(f"""
select count(*) from read_parquet('{OUT}')
where not vaso_active and not sedative_active and not vaso_start_60m and not sedative_start_60m
""").fetchone()[0])
print("vaso_active",con.execute(f"select count(*) from read_parquet('{OUT}') where vaso_active").fetchone()[0])
print("sedative_active",con.execute(f"select count(*) from read_parquet('{OUT}') where sedative_active").fetchone()[0])
print("sample",con.execute(f"select count(*) from read_parquet('{SAMPLE}')").fetchone()[0])
for r in con.execute(f"select itemid,count(*) from read_parquet('{SAMPLE}') group by itemid order by itemid").fetchall():
    print("sample_item",*r)
