#!/usr/bin/env python3
from pathlib import Path
import duckdb

DER=Path("/Users/philipbernard/mimic-data/derived")
HIST=DER/"preindex_peep_history.parquet"
VENT=DER/"vent_chart_events.parquet"
OUT=DER/"preindex_peep_history_clean.parquet"

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("PRAGMA memory_limit='4GB'")

con.execute(f"""
COPY (
WITH h AS (
  SELECT * FROM read_parquet('{HIST}')
),
x AS (
  SELECT h.*,

    (SELECT valuenum FROM read_parquet('{VENT}') v
     WHERE v.stay_id=h.stay_id AND v.itemid=223835
       AND v.charttime BETWEEN h.historical_transition_time-INTERVAL '2 hours'
                           AND h.historical_transition_time
       AND v.valuenum IS NOT NULL
     ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1) fio2_before,

    (SELECT valuenum FROM read_parquet('{VENT}') v
     WHERE v.stay_id=h.stay_id AND v.itemid=223835
       AND v.charttime > h.historical_transition_time
       AND v.charttime <= least(
         h.historical_transition_time+INTERVAL '2 hours',
         h.index_transition_time
       )
       AND v.valuenum IS NOT NULL
     ORDER BY v.charttime ASC,v.storetime ASC LIMIT 1) fio2_after,

    (SELECT value FROM read_parquet('{VENT}') v
     WHERE v.stay_id=h.stay_id AND v.itemid IN (223849,229314)
       AND v.charttime BETWEEN h.historical_transition_time-INTERVAL '2 hours'
                           AND h.historical_transition_time
       AND v.value IS NOT NULL
     ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1) mode_before,

    (SELECT value FROM read_parquet('{VENT}') v
     WHERE v.stay_id=h.stay_id AND v.itemid IN (223849,229314)
       AND v.charttime > h.historical_transition_time
       AND v.charttime <= least(
         h.historical_transition_time+INTERVAL '2 hours',
         h.index_transition_time
       )
       AND v.value IS NOT NULL
     ORDER BY v.charttime ASC,v.storetime ASC LIMIT 1) mode_after

  FROM h
),
norm AS (
  SELECT *,
    CASE WHEN fio2_before BETWEEN 0.21 AND 1.0 THEN fio2_before*100 ELSE fio2_before END fio2_before_pct,
    CASE WHEN fio2_after BETWEEN 0.21 AND 1.0 THEN fio2_after*100 ELSE fio2_after END fio2_after_pct
  FROM x
)
SELECT *,
  CASE
    WHEN fio2_before_pct BETWEEN 21 AND 100
     AND fio2_after_pct BETWEEN 21 AND 100
     AND abs(fio2_after_pct-fio2_before_pct) < 5
    THEN true ELSE false
  END fio2_stable,

  CASE
    WHEN mode_before IS NULL OR mode_after IS NULL THEN NULL
    WHEN mode_before=mode_after THEN true
    ELSE false
  END mode_stable

FROM norm
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("rows",con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
print("index_events",con.execute(f"select count(distinct stay_id || ':' || cast(index_transition_time as varchar)) from read_parquet('{OUT}')").fetchone()[0])
print("fio2_stable",con.execute(f"select count(*) from read_parquet('{OUT}') where fio2_stable").fetchone()[0])
print("mode_stable_true",con.execute(f"select count(*) from read_parquet('{OUT}') where mode_stable=true").fetchone()[0])
print("clean_both",con.execute(f"select count(*) from read_parquet('{OUT}') where fio2_stable and mode_stable=true").fetchone()[0])
print("clean_index_events",con.execute(f"""
select count(distinct stay_id || ':' || cast(index_transition_time as varchar))
from read_parquet('{OUT}')
where fio2_stable and mode_stable=true
""").fetchone()[0])
print("clean_with_prepost_spo2",con.execute(f"""
select count(*) from read_parquet('{OUT}')
where fio2_stable and mode_stable=true
  and historical_pre_spo2 is not null and historical_post_spo2 is not null
""").fetchone()[0])
print("clean_with_prepost_abg",con.execute(f"""
select count(*) from read_parquet('{OUT}')
where fio2_stable and mode_stable=true
  and historical_pre_po2 is not null and historical_post_po2 is not null
""").fetchone()[0])
