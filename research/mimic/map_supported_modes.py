#!/usr/bin/env python3
from pathlib import Path
import duckdb

DER=Path("/Users/philipbernard/mimic-data/derived")
POOL=DER/"pilot_invasive_screened_pool.parquet"
VENT=DER/"vent_chart_events.parquet"
OUT=DER/"pilot_supported_mode_pool.parquet"

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("PRAGMA memory_limit='4GB'")

con.execute(f"""
COPY (
WITH x AS (
 SELECT p.*,
   (
    SELECT value FROM read_parquet('{VENT}') v
    WHERE v.stay_id=p.stay_id AND v.itemid IN (223849,229314)
      AND v.charttime BETWEEN p.transition_time-INTERVAL '2 hours' AND p.transition_time
      AND v.value IS NOT NULL
    ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1
   ) pre_mode,
   coalesce(
     CASE WHEN p.itemid=223835 THEN p.prev_x END,
     (SELECT valuenum FROM read_parquet('{VENT}') v
      WHERE v.stay_id=p.stay_id AND v.itemid=223835
        AND v.charttime BETWEEN p.transition_time-INTERVAL '2 hours' AND p.transition_time
        AND v.valuenum IS NOT NULL
      ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1)
   ) pre_fio2,
   coalesce(
     CASE WHEN p.itemid=220339 THEN p.prev_x END,
     (SELECT valuenum FROM read_parquet('{VENT}') v
      WHERE v.stay_id=p.stay_id AND v.itemid=220339
        AND v.charttime BETWEEN p.transition_time-INTERVAL '2 hours' AND p.transition_time
        AND v.valuenum IS NOT NULL
      ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1)
   ) pre_peep,
   coalesce(
     CASE WHEN p.itemid=224688 THEN p.prev_x END,
     (SELECT valuenum FROM read_parquet('{VENT}') v
      WHERE v.stay_id=p.stay_id AND v.itemid=224688
        AND v.charttime BETWEEN p.transition_time-INTERVAL '2 hours' AND p.transition_time
        AND v.valuenum IS NOT NULL
      ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1)
   ) pre_rr_set,
   coalesce(
     CASE WHEN p.itemid=224684 THEN p.prev_x END,
     (SELECT valuenum FROM read_parquet('{VENT}') v
      WHERE v.stay_id=p.stay_id AND v.itemid=224684
        AND v.charttime BETWEEN p.transition_time-INTERVAL '2 hours' AND p.transition_time
        AND v.valuenum IS NOT NULL
      ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1)
   ) pre_vt_set,
   (SELECT valuenum FROM read_parquet('{VENT}') v
    WHERE v.stay_id=p.stay_id AND v.itemid=224701
      AND v.charttime BETWEEN p.transition_time-INTERVAL '2 hours' AND p.transition_time
      AND v.valuenum IS NOT NULL
    ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1) pre_psv,
   (SELECT valuenum FROM read_parquet('{VENT}') v
    WHERE v.stay_id=p.stay_id AND v.itemid IN (224702,227187,229663)
      AND v.charttime BETWEEN p.transition_time-INTERVAL '2 hours' AND p.transition_time
      AND v.valuenum IS NOT NULL
    ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1) pre_pinsp
 FROM read_parquet('{POOL}') p
),
mapped AS (
 SELECT *,
   CASE
     WHEN pre_mode IN ('SPONT','CPAP/PSV','PSV/SBT','CPAP/PPS')
       AND pre_psv IS NOT NULL
       THEN 'PS'
     WHEN pre_mode IN ('P-CMV','PCV+Assist','PRES/AC')
       AND pre_rr_set IS NOT NULL AND pre_pinsp IS NOT NULL
       THEN 'PC_AC'
     WHEN pre_mode IN ('VOL/AC','CMV/ASSIST','CMV')
       AND pre_rr_set IS NOT NULL AND pre_vt_set IS NOT NULL
       AND pre_pinsp IS NULL
       THEN 'VC_AC'
     WHEN pre_mode IN ('SIMV/PSV','SIMV/PRES')
       AND pre_rr_set IS NOT NULL AND pre_pinsp IS NOT NULL AND pre_psv IS NOT NULL
       THEN 'SIMV'
     ELSE NULL
   END hummod_mode
 FROM x
)
SELECT *
FROM mapped
WHERE hummod_mode IS NOT NULL
  AND pre_fio2 IS NOT NULL
  AND pre_peep IS NOT NULL
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("supported",con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
print("stays",con.execute(f"select count(distinct stay_id) from read_parquet('{OUT}')").fetchone()[0])
for r in con.execute(f"""
select hummod_mode,count(*) n,count(distinct stay_id) stays
from read_parquet('{OUT}') group by hummod_mode order by n desc
""").fetchall():
    print("mode",*r)
for r in con.execute(f"""
select itemid,count(*) n from read_parquet('{OUT}') group by itemid order by itemid
""").fetchall():
    print("item",*r)
