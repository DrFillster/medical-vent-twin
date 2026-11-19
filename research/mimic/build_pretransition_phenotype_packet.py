#!/usr/bin/env python3
from pathlib import Path
import duckdb, hashlib

DER=Path("/Users/philipbernard/mimic-data/derived")
BASE=DER/"phenotype_inputs_with_etco2.parquet"
HIST=DER/"preindex_peep_history_clean.parquet"
OUT=DER/"pretransition_phenotype_packet.parquet"

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("PRAGMA memory_limit='4GB'")

# Build one row per supported index transition. Patient identifiers remain local.
con.execute(f"""
COPY (
WITH p AS (
  SELECT * FROM read_parquet('{BASE}')
),
h AS (
  SELECT
    stay_id,
    index_transition_time transition_time,
    index_transition_itemid transition_itemid,
    count(*) FILTER (
      WHERE fio2_stable AND mode_stable=true
    ) historical_peep_clean_count,
    count(*) FILTER (
      WHERE fio2_stable AND mode_stable=true
        AND date_diff('minute',historical_pre_abg_time,historical_transition_time) <= 30
        AND date_diff('minute',historical_transition_time,historical_post_abg_time) <= 90
    ) historical_peep_tight_count,
    count(*) FILTER (
      WHERE fio2_stable AND mode_stable=true
        AND mode_before='P-CMV'
        AND historical_pre_vt_observed BETWEEN 100 AND 1000
        AND date_diff('minute',historical_pre_abg_time,historical_transition_time) <= 30
        AND date_diff('minute',historical_transition_time,historical_post_abg_time) <= 90
    ) historical_peep_controlled_tight_count
  FROM read_parquet('{HIST}')
  GROUP BY 1,2,3
),
x AS (
  SELECT
    p.*,
    coalesce(h.historical_peep_clean_count,0) historical_peep_clean_count,
    coalesce(h.historical_peep_tight_count,0) historical_peep_tight_count,
    coalesce(h.historical_peep_controlled_tight_count,0) historical_peep_controlled_tight_count
  FROM p
  LEFT JOIN h USING(stay_id,transition_time,transition_itemid)
)
SELECT
  subject_id,hadm_id,stay_id,transition_time,transition_itemid,
  hummod_mode,pre_mode,

  -- Observed bedside state
  pre_fio2,pre_peep,pre_rr_set,pre_vt_set,pre_psv,pre_pinsp,
  pre_hr,pre_map,pre_spo2,
  pre_vt_observed,pre_minute_volume,pre_rr_spontaneous,pre_rr_total,
  pre_peak_pressure,pre_plateau_pressure,pre_mean_airway_pressure,pre_total_peep,
  pre_resistance,
  coalesce(pre_compliance_documented,pre_compliance_derived) pre_compliance_best,
  case
    when pre_compliance_documented is not null then 'documented'
    when pre_compliance_derived is not null then 'derived_from_vt_plateau_peep'
    else null
  end pre_compliance_source,
  pre_ph,pre_pco2,pre_po2,pre_bicarbonate,pre_base_excess,pre_lactate,pre_pf_ratio,

  -- Dead-space / CO2 phenotype evidence
  pre_petco2,petco2_pair_minutes,measured_paco2_petco2_fraction,
  etco2_deadspace_quality,deadspace_measurement_status,
  case
    when etco2_deadspace_quality='A' then 'A'
    when etco2_deadspace_quality='B' then 'B'
    when pre_pco2 is not null
      and pre_vt_observed is not null
      and pre_minute_volume is not null
      and pre_rr_total is not null then 'C'
    else 'C'
  end deadspace_identifiability_grade,
  case
    when etco2_deadspace_quality in ('A','B')
      then 'measured_paco2_petco2_constraint'
    when pre_pco2 is not null
      and pre_vt_observed is not null
      and pre_minute_volume is not null
      and pre_rr_total is not null
      then 'latent_fit_ready'
    else 'latent_prior_only'
  end deadspace_status,

  -- Mechanics phenotype evidence
  case
    when coalesce(pre_compliance_documented,pre_compliance_derived) is not null
      and pre_resistance is not null then 'A'
    when coalesce(pre_compliance_documented,pre_compliance_derived) is not null
      or mechanics_observable_count>=2 then 'B'
    else 'C'
  end mechanics_identifiability_grade,
  case
    when coalesce(pre_compliance_documented,pre_compliance_derived) is not null
      and pre_resistance is not null then 'measured_compliance_and_resistance'
    when coalesce(pre_compliance_documented,pre_compliance_derived) is not null
      then 'compliance_constrained_fit'
    when mechanics_observable_count>=2 then 'latent_fit_ready'
    else 'prior_constrained'
  end mechanics_status,

  -- Effort phenotype evidence
  case
    when hummod_mode='PS'
      and pre_rr_total is not null
      and pre_vt_observed is not null
      and pre_minute_volume is not null
      and pre_psv is not null
      and coalesce(pre_compliance_documented,pre_compliance_derived) is not null then 'A'
    when hummod_mode='PS'
      and pre_rr_total is not null
      and pre_vt_observed is not null
      and pre_minute_volume is not null
      and pre_psv is not null then 'B'
    when hummod_mode='PS' then 'C'
    else null
  end effort_identifiability_grade,
  case
    when hummod_mode='PS'
      and pre_rr_total is not null
      and pre_vt_observed is not null
      and pre_minute_volume is not null
      and pre_psv is not null
      and coalesce(pre_compliance_documented,pre_compliance_derived) is not null
      then 'two_axis_fit_ready_with_mechanics_constraint'
    when hummod_mode='PS'
      and pre_rr_total is not null
      and pre_vt_observed is not null
      and pre_minute_volume is not null
      and pre_psv is not null
      then 'two_axis_fit_ready_mechanics_prior_required'
    when hummod_mode='PS' then 'insufficient_effort_observables'
    else 'not_primary_axis_for_controlled_mode'
  end effort_status,

  -- Oxygenation / recruitment phenotype evidence
  historical_peep_clean_count,
  historical_peep_tight_count,
  historical_peep_controlled_tight_count,
  case
    when historical_peep_controlled_tight_count>0 then 'A'
    when historical_peep_tight_count>0 then 'B'
    when historical_peep_clean_count>0 then 'C'
    else 'C'
  end recruitment_identifiability_grade,
  case
    when historical_peep_controlled_tight_count>0
      then 'historically_constrained_controlled_peep_response'
    when historical_peep_tight_count>0
      then 'historically_constrained_peep_response_effort_model_required'
    when historical_peep_clean_count>0
      then 'historical_peep_context_wide_abg_window'
    else 'baseline_oxygenation_only'
  end recruitment_status,

  -- Hemodynamic/autonomic baseline only for now
  case when pre_hr is not null and pre_map is not null then 'B' else 'C' end hemodynamic_identifiability_grade,
  case when pre_hr is not null and pre_map is not null
       then 'baseline_observed_response_gain_not_identified'
       else 'insufficient_baseline_hemodynamics' end hemodynamic_status,

  -- Fit readiness, not prediction readiness.
  case
    when pre_ph is null or pre_pco2 is null or pre_po2 is null then false
    when pre_fio2 is null or pre_peep is null then false
    when hummod_mode='PC_AC' and (pre_rr_set is null or pre_pinsp is null) then false
    when hummod_mode='VC_AC' and (pre_rr_set is null or pre_vt_set is null) then false
    when hummod_mode='PS' and (
      pre_psv is null or pre_rr_total is null or
      pre_vt_observed is null or pre_minute_volume is null
    ) then false
    else true
  end pretransition_fit_ready

FROM x
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

# Add deterministic pseudonymous event IDs without exporting patient rows.
rows=con.execute(f"""
select stay_id,transition_time,transition_itemid
from read_parquet('{OUT}')
""").fetchall()

# Re-write with event_id using a temporary relation.
event_rows=[]
for stay_id,t,itemid in rows:
    raw=f"{int(stay_id)}|{t}|{int(itemid)}"
    event_rows.append(("FIT-"+hashlib.sha256(raw.encode()).hexdigest()[:12],int(stay_id),t,int(itemid)))

con.execute("create temp table event_ids(event_id varchar,stay_id bigint,transition_time timestamp,transition_itemid bigint)")
con.executemany("insert into event_ids values (?,?,?,?)",event_rows)
tmp=DER/"pretransition_phenotype_packet_with_id.parquet"
con.execute(f"""
COPY (
select e.event_id,p.*
from read_parquet('{OUT}') p
join event_ids e using(stay_id,transition_time,transition_itemid)
) TO '{tmp}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")
OUT.unlink()
tmp.rename(OUT)

print("rows",con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
print("fit_ready",con.execute(f"select count(*) from read_parquet('{OUT}') where pretransition_fit_ready").fetchone()[0])
print("modes",con.execute(f"select hummod_mode,count(*) from read_parquet('{OUT}') group by 1 order by 2 desc").fetchall())
print("mechanics_grades",con.execute(f"select mechanics_identifiability_grade,count(*) from read_parquet('{OUT}') group by 1 order by 1").fetchall())
print("effort_grades",con.execute(f"select coalesce(effort_identifiability_grade,'NA'),count(*) from read_parquet('{OUT}') group by 1 order by 1").fetchall())
print("deadspace_grades",con.execute(f"select deadspace_identifiability_grade,count(*) from read_parquet('{OUT}') group by 1 order by 1").fetchall())
print("recruitment_grades",con.execute(f"select recruitment_identifiability_grade,count(*) from read_parquet('{OUT}') group by 1 order by 1").fetchall())
