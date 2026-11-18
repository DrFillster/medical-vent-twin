#!/usr/bin/env python3
from pathlib import Path
import duckdb, json, hashlib, pandas as pd

DER=Path("/Users/philipbernard/mimic-data/derived")
SRC=DER/"phenotype_fit_plan.parquet"
OUT=DER/"ps_fit_inputs.jsonl"

con=duckdb.connect()
rows=con.execute(f"""
SELECT *
FROM read_parquet('{SRC}')
WHERE eligible_for_primary_prefit
  AND hummod_mode='PS'
  AND effort_status='fit_discrete_profile'
ORDER BY hash(stay_id,transition_time,transition_itemid)
""").fetchdf()

def clean(v):
    if v is None or pd.isna(v): return None
    if hasattr(v,"isoformat"): return v.isoformat()
    if hasattr(v,"item"): return v.item()
    return v

written=0
with OUT.open("w") as f:
    for _,r in rows.iterrows():
        raw=f"{int(r.stay_id)}|{r.transition_time}|{int(r.transition_itemid)}"
        eid="PSFIT-"+hashlib.sha256(raw.encode()).hexdigest()[:12]
        obj={
          "event_id":eid,
          "hummod_mode":"PS",
          "vent":{
            "fio2_percent":clean(r.pre_fio2),
            "peep":clean(r.pre_peep),
            "pressure_support":clean(r.pre_psv),
            "backup_rate_prior":2.0
          },
          "targets":{
            "ph":clean(r.pre_ph),
            "pco2":clean(r.pre_pco2),
            "po2":clean(r.pre_po2),
            "spo2":clean(r.pre_spo2),
            "rr_spontaneous":clean(r.pre_rr_spontaneous),
            "rr_total":clean(r.pre_rr_total),
            "vt_observed_ml":clean(r.pre_vt_observed),
            "minute_volume":clean(r.pre_minute_volume),
            "peak_pressure":clean(r.pre_peak_pressure),
            "plateau_pressure":clean(r.pre_plateau_pressure),
            "resistance":clean(r.pre_resistance),
            "compliance_derived":clean(r.pre_compliance_derived),
            "compliance_documented":clean(r.pre_compliance_documented)
          },
          "identifiability_grade":clean(r.identifiability_grade),
          "fit_status":{
            "compliance":clean(r.compliance_status),
            "resistance":clean(r.resistance_status),
            "shunt":clean(r.shunt_status),
            "dead_space":clean(r.dead_space_status),
            "recruitability":clean(r.recruitability_status),
            "effort":clean(r.effort_status)
          }
        }
        f.write(json.dumps(obj,separators=(",",":"))+"\n")
        written+=1

print("ps_fit_inputs",written)
print("with_total_rr",sum(pd.notna(rows.pre_rr_total)))
print("with_spont_rr",sum(pd.notna(rows.pre_rr_spontaneous)))
print("with_vt",sum(pd.notna(rows.pre_vt_observed)))
print("with_mv",sum(pd.notna(rows.pre_minute_volume)))
