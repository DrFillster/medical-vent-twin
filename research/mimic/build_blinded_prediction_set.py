#!/usr/bin/env python3
from pathlib import Path
import duckdb, json

DER=Path("/Users/philipbernard/mimic-data/derived")
PHENO=DER/"pretransition_phenotype_packet.parquet"
POOL=DER/"pilot_supported_mode_pool.parquet"
CONTROLLED=DER/"controlled_fit_inputs.jsonl"
BLIND=DER/"blinded_primary_prediction_inputs.parquet"
TRUTH=DER/"blinded_primary_prediction_truth.parquet"

FIO2_ITEM=223835
PEEP_ITEM=220339

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("PRAGMA memory_limit='4GB'")

# Controlled-mode timing/flow are pre-transition controller inputs.
con.execute("create temp table controlled_inputs(event_id varchar, pre_inspiratory_flow_lps double, pre_inspiratory_time_sec double, pre_inspiratory_ratio double)")
controlled_rows=[]
if CONTROLLED.exists():
    for line in open(CONTROLLED):
        if not line.strip():
            continue
        r=json.loads(line)
        v=r.get('vent') or {}
        controlled_rows.append((
            r.get('event_id'),
            v.get('flow_lps'),
            v.get('inspiratory_time_sec'),
            v.get('inspiratory_ratio'),
        ))
if controlled_rows:
    con.executemany("insert into controlled_inputs values (?,?,?,?)",controlled_rows)

# Primary prediction inputs: pre-transition state + observed ventilator intervention only.
con.execute(f"""
COPY (
SELECT
  p.event_id,

  -- intervention
  CASE
    WHEN s.itemid={FIO2_ITEM} THEN 'FIO2'
    WHEN s.itemid={PEEP_ITEM} THEN 'PEEP'
  END intervention_type,
  s.prev_x intervention_pre_value,
  s.new_x intervention_post_value,
  s.valueuom intervention_unit,

  -- mode / controller state
  p.hummod_mode,p.pre_mode,
  p.pre_fio2,p.pre_peep,p.pre_rr_set,p.pre_vt_set,p.pre_psv,p.pre_pinsp,
  c.pre_inspiratory_flow_lps,c.pre_inspiratory_time_sec,c.pre_inspiratory_ratio,

  -- observed baseline physiology
  p.pre_hr,p.pre_map,p.pre_spo2,
  p.pre_vt_observed,p.pre_minute_volume,p.pre_rr_spontaneous,p.pre_rr_total,
  p.pre_peak_pressure,p.pre_plateau_pressure,p.pre_mean_airway_pressure,p.pre_total_peep,
  p.pre_resistance,p.pre_compliance_best,p.pre_compliance_source,
  p.pre_ph,p.pre_pco2,p.pre_po2,p.pre_bicarbonate,p.pre_base_excess,p.pre_lactate,p.pre_pf_ratio,

  -- phenotype evidence / identifiability
  p.pre_petco2,p.petco2_pair_minutes,p.measured_paco2_petco2_fraction,
  p.etco2_deadspace_quality,p.deadspace_identifiability_grade,p.deadspace_status,
  p.mechanics_identifiability_grade,p.mechanics_status,
  p.effort_identifiability_grade,p.effort_status,
  p.historical_peep_clean_count,p.historical_peep_tight_count,
  p.historical_peep_controlled_tight_count,
  p.recruitment_identifiability_grade,p.recruitment_status,
  p.hemodynamic_identifiability_grade,p.hemodynamic_status,
  p.pretransition_fit_ready

FROM read_parquet('{PHENO}') p
JOIN read_parquet('{POOL}') s
  ON s.stay_id=p.stay_id
 AND s.transition_time=p.transition_time
 AND s.itemid=p.transition_itemid
LEFT JOIN controlled_inputs c ON c.event_id=p.event_id
WHERE p.pretransition_fit_ready
  AND s.itemid IN ({FIO2_ITEM},{PEEP_ITEM})
) TO '{BLIND}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

# Held-out truth. This is not read by fitting or forward-simulation code.
con.execute(f"""
COPY (
SELECT
  p.event_id,
  CASE
    WHEN s.itemid={FIO2_ITEM} THEN 'FIO2'
    WHEN s.itemid={PEEP_ITEM} THEN 'PEEP'
  END intervention_type,

  s.post_abg_time,
  s.post_abg_minutes,
  s.post_ph,
  s.post_pco2,
  s.post_po2,
  s.post_hr,
  s.post_map,
  s.post_spo2

FROM read_parquet('{PHENO}') p
JOIN read_parquet('{POOL}') s
  ON s.stay_id=p.stay_id
 AND s.transition_time=p.transition_time
 AND s.itemid=p.transition_itemid
WHERE p.pretransition_fit_ready
  AND s.itemid IN ({FIO2_ITEM},{PEEP_ITEM})
) TO '{TRUTH}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

# Integrity checks.
blind_cols=[r[0] for r in con.execute(f"describe select * from read_parquet('{BLIND}')").fetchall()]
truth_cols=[r[0] for r in con.execute(f"describe select * from read_parquet('{TRUTH}')").fetchall()]

bad=[c for c in blind_cols if c.lower().startswith("post_") or c.lower() in {
    "post_ph","post_pco2","post_po2","post_hr","post_map","post_spo2","post_abg_time"
}]
if bad:
    raise RuntimeError("post-transition leakage in blinded input: "+",".join(bad))

n_blind=con.execute(f"select count(*) from read_parquet('{BLIND}')").fetchone()[0]
n_truth=con.execute(f"select count(*) from read_parquet('{TRUTH}')").fetchone()[0]
if n_blind != n_truth:
    raise RuntimeError(f"input/truth row mismatch: {n_blind} vs {n_truth}")

missing=con.execute(f"""
select count(*)
from read_parquet('{BLIND}') b
left join read_parquet('{TRUTH}') t using(event_id)
where t.event_id is null
""").fetchone()[0]
if missing:
    raise RuntimeError(f"{missing} blinded events missing truth rows")

print("blind_rows",n_blind)
print("truth_rows",n_truth)
print("interventions",con.execute(f"""
select intervention_type,count(*)
from read_parquet('{BLIND}')
group by 1 order by 1
""").fetchall())
print("modes",con.execute(f"""
select hummod_mode,count(*)
from read_parquet('{BLIND}')
group by 1 order by 2 desc
""").fetchall())
print("truth_complete_abg",con.execute(f"""
select count(*) from read_parquet('{TRUTH}')
where post_ph is not null and post_pco2 is not null and post_po2 is not null
""").fetchone()[0])
print("leakage_check","PASS")
