#!/usr/bin/env python3
from pathlib import Path
import duckdb, hashlib

DER=Path("/Users/philipbernard/mimic-data/derived")
POOL=DER/"pilot_primary_60min_pool.parquet"
PH=DER/"phenotype_inputs_with_etco2.parquet"
FP=DER/"phenotype_fit_plan.parquet"
TIMING=DER/"vent_timing_flow_events.parquet"
OUT=DER/"primary60_fit_manifest.parquet"

con=duckdb.connect()
con.execute("PRAGMA threads=4")

con.execute(f"""
COPY (
WITH x AS (
 SELECT
   'FIT-' || substr(sha256(cast(p.stay_id as varchar) || '|' || cast(p.transition_time as varchar) || '|' || cast(p.itemid as varchar)),1,12) event_id,
   p.subject_id,p.hadm_id,p.stay_id,p.transition_time,p.itemid transition_itemid,
   p.prev_x transition_pre_value,p.new_x transition_post_value,
   p.hummod_mode,p.pre_mode,p.pre_fio2,p.pre_peep,p.pre_rr_set,p.pre_vt_set,p.pre_psv,p.pre_pinsp,

   ph.pre_hr,ph.pre_map,ph.pre_spo2,
   ph.pre_ph,ph.pre_pco2,ph.pre_po2,ph.pre_bicarbonate,ph.pre_base_excess,ph.pre_lactate,
   ph.pre_petco2,ph.measured_paco2_petco2_fraction,ph.etco2_deadspace_quality,
   ph.pre_vt_observed,ph.pre_minute_volume,ph.pre_rr_spontaneous,ph.pre_rr_total,
   ph.pre_peak_pressure,ph.pre_plateau_pressure,ph.pre_mean_airway_pressure,ph.pre_total_peep,
   ph.pre_resistance,ph.pre_compliance_documented,ph.pre_compliance_derived,
   ph.effort_observable_count,ph.mechanics_observable_count,ph.identifiability_grade,

   fp.compliance_status,fp.resistance_status,fp.shunt_status,fp.dead_space_status,
   fp.recruitability_status,fp.effort_status,
   fp.has_preindex_peep_history,fp.has_preindex_compliance_response,
   fp.has_preindex_hemodynamic_response,

   (SELECT valuenum FROM read_parquet('{TIMING}') t
    WHERE t.stay_id=p.stay_id AND t.itemid=224691
      AND t.charttime BETWEEN p.transition_time-INTERVAL '2 hours' AND p.transition_time
      AND t.valuenum IS NOT NULL
    ORDER BY t.charttime DESC,t.storetime DESC LIMIT 1) pre_flow_l_min,

   (SELECT valuenum FROM read_parquet('{TIMING}') t
    WHERE t.stay_id=p.stay_id AND t.itemid=224738
      AND t.charttime BETWEEN p.transition_time-INTERVAL '2 hours' AND p.transition_time
      AND t.valuenum IS NOT NULL
    ORDER BY t.charttime DESC,t.storetime DESC LIMIT 1) pre_inspiratory_time_sec,

   (SELECT valuenum FROM read_parquet('{TIMING}') t
    WHERE t.stay_id=p.stay_id AND t.itemid=226873
      AND t.charttime BETWEEN p.transition_time-INTERVAL '2 hours' AND p.transition_time
      AND t.valuenum IS NOT NULL
    ORDER BY t.charttime DESC,t.storetime DESC LIMIT 1) pre_inspiratory_ratio

 FROM read_parquet('{POOL}') p
 JOIN read_parquet('{PH}') ph
   ON ph.stay_id=p.stay_id
  AND ph.transition_time=p.transition_time
  AND ph.transition_itemid=p.itemid
 JOIN read_parquet('{FP}') fp
   ON fp.stay_id=p.stay_id
  AND fp.transition_time=p.transition_time
  AND fp.transition_itemid=p.itemid
)
SELECT *,
  CASE
    WHEN hummod_mode='PS' AND effort_observable_count>=2 THEN true
    WHEN hummod_mode='PC_AC'
      AND pre_rr_set IS NOT NULL AND pre_pinsp IS NOT NULL
      AND pre_inspiratory_time_sec IS NOT NULL THEN true
    WHEN hummod_mode='VC_AC'
      AND pre_rr_set IS NOT NULL AND pre_vt_set IS NOT NULL
      AND (
        pre_flow_l_min IS NOT NULL OR
        pre_inspiratory_time_sec IS NOT NULL OR
        pre_inspiratory_ratio IS NOT NULL
      ) THEN true
    ELSE false
  END mode_controller_ready,

  CASE
    WHEN etco2_deadspace_quality IN ('A','B') THEN 'measured_etco2'
    ELSE 'latent_effective_deadspace'
  END deadspace_source_plan,

  CASE
    WHEN has_preindex_peep_history THEN 'history_decomposable'
    ELSE 'composite_effective_oxygenation'
  END oxygenation_source_plan
FROM x
WHERE identifiability_grade IN ('A','B')
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("manifest",con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
print("controller_ready",con.execute(f"select count(*) from read_parquet('{OUT}') where mode_controller_ready").fetchone()[0])
for r in con.execute(f"""
select hummod_mode,count(*) n,count(*) filter(where mode_controller_ready) ready
from read_parquet('{OUT}') group by 1 order by 1
""").fetchall(): print("mode",*r)
for r in con.execute(f"""
select deadspace_source_plan,count(*) n from read_parquet('{OUT}') group by 1 order by 1
""").fetchall(): print("deadspace",*r)
for r in con.execute(f"""
select oxygenation_source_plan,count(*) n from read_parquet('{OUT}') group by 1 order by 1
""").fetchall(): print("oxygenation",*r)
