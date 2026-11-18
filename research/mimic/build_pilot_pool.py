#!/usr/bin/env python3
from pathlib import Path
import duckdb

DER=Path("/Users/philipbernard/mimic-data/derived")
T=DER/"ventilator_transitions_clean.parquet"
A=DER/"arterial_blood_gases.parquet"
V=DER/"vent_chart_events.parquet"
I=DER/"adult_icustays.parquet"
OUT=DER/"pilot_transition_pool.parquet"
SAMPLE=DER/"pilot_review_sample_100.parquet"

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("PRAGMA memory_limit='4GB'")
con.execute("PRAGMA temp_directory='/Users/philipbernard/mimic-data/tmp'")

# First pilot uses the four most interpretable discrete ventilator settings.
# Windows are screening parameters for manual review, not final protocol claims.
core_ids=(223835,220339,224688,224684)
vital_ids=(220045,220052,220277)

con.execute(f"""
COPY (
WITH core AS (
  SELECT t.*, i.intime, i.outtime,
    count(*) OVER (
      PARTITION BY t.stay_id
      ORDER BY t.transition_time
      RANGE BETWEEN INTERVAL '30 minutes' PRECEDING AND INTERVAL '30 minutes' FOLLOWING
    ) AS nearby_changes
  FROM read_parquet('{T}') t
  JOIN read_parquet('{I}') i USING(stay_id)
  WHERE t.itemid IN {core_ids}
),
isolated AS (
  SELECT * FROM core WHERE nearby_changes=1
),
linked AS (
 SELECT x.*,
   pre.charttime pre_abg_time, pre.ph pre_ph, pre.pco2 pre_pco2, pre.po2 pre_po2,
   post.charttime post_abg_time, post.ph post_ph, post.pco2 post_pco2, post.po2 post_po2,
   prehr.valuenum pre_hr, posthr.valuenum post_hr,
   premap.valuenum pre_map, postmap.valuenum post_map,
   prespo2.valuenum pre_spo2, postspo2.valuenum post_spo2
 FROM isolated x
 LEFT JOIN LATERAL (
   SELECT * FROM read_parquet('{A}') a
   WHERE a.hadm_id=x.hadm_id
     AND a.charttime BETWEEN greatest(x.intime,x.transition_time-INTERVAL '4 hours') AND x.transition_time
     AND a.ph IS NOT NULL AND a.pco2 IS NOT NULL AND a.po2 IS NOT NULL
   ORDER BY a.charttime DESC LIMIT 1
 ) pre ON true
 LEFT JOIN LATERAL (
   SELECT * FROM read_parquet('{A}') a
   WHERE a.hadm_id=x.hadm_id
     AND a.charttime > x.transition_time
     AND a.charttime <= least(x.outtime,x.transition_time+INTERVAL '6 hours')
     AND a.ph IS NOT NULL AND a.pco2 IS NOT NULL AND a.po2 IS NOT NULL
   ORDER BY a.charttime ASC LIMIT 1
 ) post ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{V}') v
   WHERE v.stay_id=x.stay_id AND v.itemid=220045 AND v.valuenum BETWEEN 20 AND 250
     AND v.charttime BETWEEN x.transition_time-INTERVAL '1 hour' AND x.transition_time
   ORDER BY v.charttime DESC LIMIT 1
 ) prehr ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{V}') v
   WHERE v.stay_id=x.stay_id AND v.itemid=220045 AND v.valuenum BETWEEN 20 AND 250
     AND v.charttime > x.transition_time AND v.charttime <= x.transition_time+INTERVAL '2 hours'
   ORDER BY v.charttime ASC LIMIT 1
 ) posthr ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{V}') v
   WHERE v.stay_id=x.stay_id AND v.itemid=220052 AND v.valuenum BETWEEN 20 AND 200
     AND v.charttime BETWEEN x.transition_time-INTERVAL '1 hour' AND x.transition_time
   ORDER BY v.charttime DESC LIMIT 1
 ) premap ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{V}') v
   WHERE v.stay_id=x.stay_id AND v.itemid=220052 AND v.valuenum BETWEEN 20 AND 200
     AND v.charttime > x.transition_time AND v.charttime <= x.transition_time+INTERVAL '2 hours'
   ORDER BY v.charttime ASC LIMIT 1
 ) postmap ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{V}') v
   WHERE v.stay_id=x.stay_id AND v.itemid=220277 AND v.valuenum BETWEEN 50 AND 100
     AND v.charttime BETWEEN x.transition_time-INTERVAL '1 hour' AND x.transition_time
   ORDER BY v.charttime DESC LIMIT 1
 ) prespo2 ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{V}') v
   WHERE v.stay_id=x.stay_id AND v.itemid=220277 AND v.valuenum BETWEEN 50 AND 100
     AND v.charttime > x.transition_time AND v.charttime <= x.transition_time+INTERVAL '2 hours'
   ORDER BY v.charttime ASC LIMIT 1
 ) postspo2 ON true
)
SELECT *,
  date_diff('minute',pre_abg_time,transition_time) pre_abg_minutes,
  date_diff('minute',transition_time,post_abg_time) post_abg_minutes
FROM linked
WHERE pre_abg_time IS NOT NULL AND post_abg_time IS NOT NULL
  AND pre_hr IS NOT NULL AND post_hr IS NOT NULL
  AND pre_map IS NOT NULL AND post_map IS NOT NULL
  AND pre_spo2 IS NOT NULL AND post_spo2 IS NOT NULL
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

# Balanced deterministic review sample, up to 25 per core intervention.
con.execute(f"""
COPY (
  WITH r AS (
    SELECT *, row_number() OVER (
      PARTITION BY itemid ORDER BY hash(stay_id,transition_time,itemid)
    ) rn
    FROM read_parquet('{OUT}')
  )
  SELECT * FROM r WHERE rn<=25
) TO '{SAMPLE}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("pilot_pool",con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
print("pilot_stays",con.execute(f"select count(distinct stay_id) from read_parquet('{OUT}')").fetchone()[0])
for r in con.execute(f"select itemid,count(*) n,count(distinct stay_id) stays from read_parquet('{OUT}') group by itemid order by itemid").fetchall():
    print("item",*r)
print("review_sample",con.execute(f"select count(*) from read_parquet('{SAMPLE}')").fetchone()[0])
