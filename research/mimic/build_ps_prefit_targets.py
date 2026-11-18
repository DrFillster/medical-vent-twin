#!/usr/bin/env python3
from pathlib import Path
import duckdb

DER=Path("/Users/philipbernard/mimic-data/derived")
POOL=DER/"pilot_supported_mode_pool.parquet"
VENT=DER/"vent_chart_events.parquet"
OUT=DER/"ps_prefit_targets.parquet"

con=duckdb.connect()
con.execute("PRAGMA threads=4")

con.execute(f"""
COPY (
WITH ps AS (
 SELECT * FROM read_parquet('{POOL}') WHERE hummod_mode='PS'
),
x AS (
 SELECT ps.*,
   (SELECT valuenum FROM read_parquet('{VENT}') v
    WHERE v.stay_id=ps.stay_id AND v.itemid=224689
      AND v.charttime BETWEEN ps.transition_time-INTERVAL '2 hours' AND ps.transition_time
      AND v.valuenum IS NOT NULL
    ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1) pre_spont_rr,
   (SELECT valuenum FROM read_parquet('{VENT}') v
    WHERE v.stay_id=ps.stay_id AND v.itemid=224690
      AND v.charttime BETWEEN ps.transition_time-INTERVAL '2 hours' AND ps.transition_time
      AND v.valuenum IS NOT NULL
    ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1) pre_total_rr,
   (SELECT valuenum FROM read_parquet('{VENT}') v
    WHERE v.stay_id=ps.stay_id AND v.itemid=224685
      AND v.charttime BETWEEN ps.transition_time-INTERVAL '2 hours' AND ps.transition_time
      AND v.valuenum IS NOT NULL
    ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1) pre_observed_vt,
   (SELECT valuenum FROM read_parquet('{VENT}') v
    WHERE v.stay_id=ps.stay_id AND v.itemid=224687
      AND v.charttime BETWEEN ps.transition_time-INTERVAL '2 hours' AND ps.transition_time
      AND v.valuenum IS NOT NULL
    ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1) pre_minute_volume,
   (SELECT valuenum FROM read_parquet('{VENT}') v
    WHERE v.stay_id=ps.stay_id AND v.itemid=224695
      AND v.charttime BETWEEN ps.transition_time-INTERVAL '2 hours' AND ps.transition_time
      AND v.valuenum IS NOT NULL
    ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1) pre_peak_pressure,
   (SELECT valuenum FROM read_parquet('{VENT}') v
    WHERE v.stay_id=ps.stay_id AND v.itemid=224700
      AND v.charttime BETWEEN ps.transition_time-INTERVAL '2 hours' AND ps.transition_time
      AND v.valuenum IS NOT NULL
    ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1) pre_total_peep
 FROM ps
)
SELECT *,
  ((pre_spont_rr IS NOT NULL)::INT +
   (pre_total_rr IS NOT NULL)::INT +
   (pre_observed_vt IS NOT NULL)::INT +
   (pre_minute_volume IS NOT NULL)::INT) observable_count
FROM x
WHERE ((pre_spont_rr IS NOT NULL)::INT +
       (pre_total_rr IS NOT NULL)::INT +
       (pre_observed_vt IS NOT NULL)::INT +
       (pre_minute_volume IS NOT NULL)::INT) >= 2
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("ps_prefit",con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
print("core3",con.execute(f"""
select count(*) from read_parquet('{OUT}')
where pre_total_rr is not null and pre_observed_vt is not null and pre_minute_volume is not null
""").fetchone()[0])
print("stays",con.execute(f"select count(distinct stay_id) from read_parquet('{OUT}')").fetchone()[0])
