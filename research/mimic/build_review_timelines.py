#!/usr/bin/env python3
from pathlib import Path
import duckdb

RAW=Path("/Users/philipbernard/mimic-data/raw/mimiciv/3.1/mimiciv-3.1")
DER=Path("/Users/philipbernard/mimic-data/derived")
SAMPLE=DER/"pilot_review_sample_strict_clean_100.parquet"
INPUT=RAW/"icu/inputevents.csv.gz"
VENT=DER/"vent_chart_events.parquet"
ABG=DER/"arterial_blood_gases.parquet"
OUT=DER/"pilot_review_timeline_100.parquet"
FLAGS=DER/"pilot_review_confounders_100.parquet"

vaso=(221289,221653,221662,221749,221906,222315,229617,229630,229631,229632)
sed=(221668,221712,221744,222168,225150,225154,225942,225972,229420)
meds=tuple(sorted(set(vaso+sed)))
vent_items=(220045,220052,220277,220339,223835,223849,224684,224685,224687,224688,224689,224690,224695,224696,224697,224700,224701,224702,227187,229314,229663)

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("PRAGMA memory_limit='4GB'")
con.execute("PRAGMA temp_directory='/Users/philipbernard/mimic-data/tmp'")

con.execute(f"""
COPY (
WITH s AS (
 SELECT *,
   printf('EVT-%03d', row_number() over(order by itemid,transition_time,stay_id)) event_id
 FROM read_parquet('{SAMPLE}')
),
m AS (
 SELECT s.event_id,s.stay_id,s.transition_time,i.itemid,i.starttime,i.endtime,
        i.rate,i.rateuom,i.amount,i.amountuom,i.statusdescription,
        CASE WHEN i.itemid IN {vaso} THEN 'vasoactive' ELSE 'sedative_analgesic' END med_class
 FROM s
 JOIN read_csv_auto('{INPUT}',header=true,sample_size=200000) i
   ON i.stay_id=s.stay_id
  AND i.itemid IN {meds}
  AND i.starttime <= s.transition_time + INTERVAL '60 minutes'
  AND coalesce(i.endtime,i.starttime) >= s.transition_time - INTERVAL '60 minutes'
)
SELECT s.event_id,s.itemid transition_itemid,s.transition_time,
  EXISTS(SELECT 1 FROM m WHERE m.event_id=s.event_id AND m.med_class='vasoactive' AND m.starttime<=s.transition_time AND coalesce(m.endtime,m.starttime)>=s.transition_time) vaso_active,
  EXISTS(SELECT 1 FROM m WHERE m.event_id=s.event_id AND m.med_class='sedative_analgesic' AND m.starttime<=s.transition_time AND coalesce(m.endtime,m.starttime)>=s.transition_time) sedative_active,
  EXISTS(SELECT 1 FROM m WHERE m.event_id=s.event_id AND m.med_class='vasoactive' AND m.starttime BETWEEN s.transition_time-INTERVAL '60 minutes' AND s.transition_time+INTERVAL '60 minutes') vaso_start_60m,
  EXISTS(SELECT 1 FROM m WHERE m.event_id=s.event_id AND m.med_class='sedative_analgesic' AND m.starttime BETWEEN s.transition_time-INTERVAL '60 minutes' AND s.transition_time+INTERVAL '60 minutes') sedative_start_60m,
  (SELECT count(distinct itemid) FROM m WHERE m.event_id=s.event_id AND med_class='vasoactive') vaso_agents_nearby,
  (SELECT count(distinct itemid) FROM m WHERE m.event_id=s.event_id AND med_class='sedative_analgesic') sedative_agents_nearby
FROM s
) TO '{FLAGS}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

con.execute(f"""
COPY (
WITH s AS (
 SELECT *,
   printf('EVT-%03d', row_number() over(order by itemid,transition_time,stay_id)) event_id
 FROM read_parquet('{SAMPLE}')
),
vent AS (
 SELECT s.event_id,'chart' source,v.charttime event_time,v.itemid,
        v.value,v.valuenum,v.valueuom,
        NULL::TIMESTAMP endtime,NULL::DOUBLE rate,NULL::VARCHAR rateuom
 FROM s JOIN read_parquet('{VENT}') v
   ON v.stay_id=s.stay_id
  AND v.itemid IN {vent_items}
  AND v.charttime BETWEEN s.transition_time-INTERVAL '4 hours' AND s.transition_time+INTERVAL '6 hours'
),
bg AS (
 SELECT s.event_id,'abg' source,a.charttime event_time,0 itemid,
        NULL::VARCHAR value,NULL::DOUBLE valuenum,NULL::VARCHAR valueuom,
        NULL::TIMESTAMP endtime,NULL::DOUBLE rate,NULL::VARCHAR rateuom
 FROM s JOIN read_parquet('{ABG}') a
   ON a.hadm_id=s.hadm_id
  AND a.charttime BETWEEN s.transition_time-INTERVAL '4 hours' AND s.transition_time+INTERVAL '6 hours'
),
med AS (
 SELECT s.event_id,'med' source,i.starttime event_time,i.itemid,
        i.statusdescription value,i.amount valuenum,i.amountuom valueuom,
        i.endtime,i.rate,i.rateuom
 FROM s JOIN read_csv_auto('{INPUT}',header=true,sample_size=200000) i
   ON i.stay_id=s.stay_id
  AND i.itemid IN {meds}
  AND i.starttime <= s.transition_time+INTERVAL '2 hours'
  AND coalesce(i.endtime,i.starttime) >= s.transition_time-INTERVAL '2 hours'
)
SELECT * FROM vent
UNION ALL BY NAME SELECT * FROM bg
UNION ALL BY NAME SELECT * FROM med
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("timeline_rows",con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
print("vaso_active",con.execute(f"select count(*) from read_parquet('{FLAGS}') where vaso_active").fetchone()[0])
print("sedative_active",con.execute(f"select count(*) from read_parquet('{FLAGS}') where sedative_active").fetchone()[0])
print("neither_active",con.execute(f"select count(*) from read_parquet('{FLAGS}') where not vaso_active and not sedative_active").fetchone()[0])
