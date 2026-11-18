#!/usr/bin/env python3
from pathlib import Path
import duckdb

DER=Path("/Users/philipbernard/mimic-data/derived")
INDEX=DER/"pilot_supported_mode_pool.parquet"
TRANS=DER/"ventilator_transitions_clean.parquet"
ABG=DER/"arterial_blood_gases.parquet"
VENT=DER/"vent_chart_events.parquet"
OUT=DER/"preindex_peep_history.parquet"

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("PRAGMA memory_limit='4GB'")

con.execute(f"""
COPY (
WITH idx AS (
 SELECT * FROM read_parquet('{INDEX}')
),
hist AS (
 SELECT
   i.subject_id,i.hadm_id,i.stay_id,
   i.transition_time index_transition_time,
   i.itemid index_transition_itemid,
   i.hummod_mode,
   t.transition_time historical_transition_time,
   t.prev_x historical_peep_before,
   t.new_x historical_peep_after
 FROM idx i
 JOIN read_parquet('{TRANS}') t
   ON t.stay_id=i.stay_id
  AND t.itemid=220339
  AND t.transition_time BETWEEN i.transition_time-INTERVAL '24 hours'
                            AND i.transition_time-INTERVAL '2 hours'
),
linked AS (
 SELECT h.*,

   pre.charttime historical_pre_abg_time,
   pre.ph historical_pre_ph,
   pre.pco2 historical_pre_pco2,
   pre.po2 historical_pre_po2,

   post.charttime historical_post_abg_time,
   post.ph historical_post_ph,
   post.pco2 historical_post_pco2,
   post.po2 historical_post_po2,

   preplat.valuenum historical_pre_plateau,
   postplat.valuenum historical_post_plateau,
   prevt.valuenum historical_pre_vt_observed,
   postvt.valuenum historical_post_vt_observed,
   premv.valuenum historical_pre_minute_volume,
   postmv.valuenum historical_post_minute_volume,
   prepeak.valuenum historical_pre_peak_pressure,
   postpeak.valuenum historical_post_peak_pressure,
   prehr.valuenum historical_pre_hr,
   posthr.valuenum historical_post_hr,
   premap.valuenum historical_pre_map,
   postmap.valuenum historical_post_map,
   prespo2.valuenum historical_pre_spo2,
   postspo2.valuenum historical_post_spo2

 FROM hist h

 LEFT JOIN LATERAL (
   SELECT * FROM read_parquet('{ABG}') a
   WHERE a.hadm_id=h.hadm_id
     AND a.charttime BETWEEN h.historical_transition_time-INTERVAL '2 hours'
                         AND h.historical_transition_time
     AND a.charttime < h.index_transition_time
     AND a.ph IS NOT NULL AND a.pco2 IS NOT NULL AND a.po2 IS NOT NULL
   ORDER BY a.charttime DESC LIMIT 1
 ) pre ON true

 LEFT JOIN LATERAL (
   SELECT * FROM read_parquet('{ABG}') a
   WHERE a.hadm_id=h.hadm_id
     AND a.charttime > h.historical_transition_time
     AND a.charttime <= least(
       h.historical_transition_time+INTERVAL '4 hours',
       h.index_transition_time
     )
     AND a.ph IS NOT NULL AND a.pco2 IS NOT NULL AND a.po2 IS NOT NULL
   ORDER BY a.charttime ASC LIMIT 1
 ) post ON true

 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=h.stay_id AND v.itemid=224696
     AND v.charttime BETWEEN h.historical_transition_time-INTERVAL '2 hours'
                         AND h.historical_transition_time
   ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1
 ) preplat ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=h.stay_id AND v.itemid=224696
     AND v.charttime > h.historical_transition_time
     AND v.charttime <= least(h.historical_transition_time+INTERVAL '2 hours',h.index_transition_time)
   ORDER BY v.charttime ASC,v.storetime ASC LIMIT 1
 ) postplat ON true

 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=h.stay_id AND v.itemid=224685
     AND v.charttime BETWEEN h.historical_transition_time-INTERVAL '2 hours'
                         AND h.historical_transition_time
   ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1
 ) prevt ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=h.stay_id AND v.itemid=224685
     AND v.charttime > h.historical_transition_time
     AND v.charttime <= least(h.historical_transition_time+INTERVAL '2 hours',h.index_transition_time)
   ORDER BY v.charttime ASC,v.storetime ASC LIMIT 1
 ) postvt ON true

 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=h.stay_id AND v.itemid=224687
     AND v.charttime BETWEEN h.historical_transition_time-INTERVAL '2 hours'
                         AND h.historical_transition_time
   ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1
 ) premv ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=h.stay_id AND v.itemid=224687
     AND v.charttime > h.historical_transition_time
     AND v.charttime <= least(h.historical_transition_time+INTERVAL '2 hours',h.index_transition_time)
   ORDER BY v.charttime ASC,v.storetime ASC LIMIT 1
 ) postmv ON true

 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=h.stay_id AND v.itemid=224695
     AND v.charttime BETWEEN h.historical_transition_time-INTERVAL '2 hours'
                         AND h.historical_transition_time
   ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1
 ) prepeak ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=h.stay_id AND v.itemid=224695
     AND v.charttime > h.historical_transition_time
     AND v.charttime <= least(h.historical_transition_time+INTERVAL '2 hours',h.index_transition_time)
   ORDER BY v.charttime ASC,v.storetime ASC LIMIT 1
 ) postpeak ON true

 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=h.stay_id AND v.itemid=220045
     AND v.charttime BETWEEN h.historical_transition_time-INTERVAL '1 hour'
                         AND h.historical_transition_time
   ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1
 ) prehr ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=h.stay_id AND v.itemid=220045
     AND v.charttime > h.historical_transition_time
     AND v.charttime <= least(h.historical_transition_time+INTERVAL '2 hours',h.index_transition_time)
   ORDER BY v.charttime ASC,v.storetime ASC LIMIT 1
 ) posthr ON true

 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=h.stay_id AND v.itemid=220052
     AND v.charttime BETWEEN h.historical_transition_time-INTERVAL '1 hour'
                         AND h.historical_transition_time
   ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1
 ) premap ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=h.stay_id AND v.itemid=220052
     AND v.charttime > h.historical_transition_time
     AND v.charttime <= least(h.historical_transition_time+INTERVAL '2 hours',h.index_transition_time)
   ORDER BY v.charttime ASC,v.storetime ASC LIMIT 1
 ) postmap ON true

 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=h.stay_id AND v.itemid=220277
     AND v.charttime BETWEEN h.historical_transition_time-INTERVAL '1 hour'
                         AND h.historical_transition_time
   ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1
 ) prespo2 ON true
 LEFT JOIN LATERAL (
   SELECT valuenum FROM read_parquet('{VENT}') v
   WHERE v.stay_id=h.stay_id AND v.itemid=220277
     AND v.charttime > h.historical_transition_time
     AND v.charttime <= least(h.historical_transition_time+INTERVAL '2 hours',h.index_transition_time)
   ORDER BY v.charttime ASC,v.storetime ASC LIMIT 1
 ) postspo2 ON true
)
SELECT *,
  CASE WHEN historical_pre_plateau IS NOT NULL
            AND historical_pre_vt_observed IS NOT NULL
            AND historical_pre_plateau > historical_peep_before
       THEN historical_pre_vt_observed/(historical_pre_plateau-historical_peep_before)
  END historical_pre_compliance,
  CASE WHEN historical_post_plateau IS NOT NULL
            AND historical_post_vt_observed IS NOT NULL
            AND historical_post_plateau > historical_peep_after
       THEN historical_post_vt_observed/(historical_post_plateau-historical_peep_after)
  END historical_post_compliance
FROM linked
WHERE historical_pre_abg_time IS NOT NULL
  AND historical_post_abg_time IS NOT NULL
  AND (
    historical_pre_plateau IS NOT NULL OR
    historical_post_plateau IS NOT NULL OR
    historical_pre_vt_observed IS NOT NULL OR
    historical_post_vt_observed IS NOT NULL OR
    historical_pre_minute_volume IS NOT NULL OR
    historical_post_minute_volume IS NOT NULL OR
    historical_pre_peak_pressure IS NOT NULL OR
    historical_post_peak_pressure IS NOT NULL
  )
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("history_rows",con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
print("index_events",con.execute(f"select count(distinct stay_id || ':' || cast(index_transition_time as varchar)) from read_parquet('{OUT}')").fetchone()[0])
print("stays",con.execute(f"select count(distinct stay_id) from read_parquet('{OUT}')").fetchone()[0])
print("compliance_pair",con.execute(f"""
select count(*) from read_parquet('{OUT}')
where historical_pre_compliance is not null and historical_post_compliance is not null
""").fetchone()[0])
print("hemodynamic_pair",con.execute(f"""
select count(*) from read_parquet('{OUT}')
where historical_pre_hr is not null and historical_post_hr is not null
  and historical_pre_map is not null and historical_post_map is not null
""").fetchone()[0])
