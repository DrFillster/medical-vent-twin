#!/usr/bin/env python3
from pathlib import Path
import duckdb, json, hashlib, pandas as pd

DER=Path("/Users/philipbernard/mimic-data/derived")
SRC=DER/"phenotype_fit_plan.parquet"
TIM=DER/"vent_timing_flow_events.parquet"
OUT=DER/"controlled_fit_inputs.jsonl"

con=duckdb.connect()
q=f"""
WITH c AS (
 SELECT * FROM read_parquet('{SRC}')
 WHERE eligible_for_primary_prefit
   AND hummod_mode IN ('VC_AC','PC_AC')
),
x AS (
 SELECT c.*,
   (SELECT valuenum FROM read_parquet('{TIM}') v
    WHERE v.stay_id=c.stay_id AND v.itemid=224691
      AND v.charttime BETWEEN c.transition_time-INTERVAL '2 hours' AND c.transition_time
      AND v.valuenum IS NOT NULL
    ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1) pre_flow_l_min,
   (SELECT valuenum FROM read_parquet('{TIM}') v
    WHERE v.stay_id=c.stay_id AND v.itemid=224738
      AND v.charttime BETWEEN c.transition_time-INTERVAL '2 hours' AND c.transition_time
      AND v.valuenum IS NOT NULL
    ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1) pre_inspiratory_time_sec,
   (SELECT valuenum FROM read_parquet('{TIM}') v
    WHERE v.stay_id=c.stay_id AND v.itemid=226873
      AND v.charttime BETWEEN c.transition_time-INTERVAL '2 hours' AND c.transition_time
      AND v.valuenum IS NOT NULL
    ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1) pre_inspiratory_ratio
 FROM c
)
SELECT * FROM x
ORDER BY hash(stay_id,transition_time,transition_itemid)
"""
rows=con.execute(q).fetchdf()

def clean(v):
    if v is None or pd.isna(v): return None
    if hasattr(v,"isoformat"): return v.isoformat()
    if hasattr(v,"item"): return v.item()
    return v

written=0
skipped=0
with OUT.open("w") as f:
    for _,r in rows.iterrows():
        mode=clean(r.hummod_mode)
        flow=clean(r.pre_flow_l_min)
        it=clean(r.pre_inspiratory_time_sec)
        if mode=="VC_AC" and flow is None and it is None:
            skipped+=1
            continue
        raw=f"{int(r.stay_id)}|{r.transition_time}|{int(r.transition_itemid)}"
        eid="FIT-"+hashlib.sha256(raw.encode()).hexdigest()[:12]
        obj={
          "event_id":eid,
          "hummod_mode":mode,
          "vent":{
            "fio2_percent":clean(r.pre_fio2),
            "peep":clean(r.pre_peep),
            "rr_set":clean(r.pre_rr_set),
            "vt_set_ml":clean(r.pre_vt_set),
            "pinsp":clean(r.pre_pinsp),
            "flow_l_min":flow,
            "inspiratory_time_sec":it,
            "inspiratory_ratio":clean(r.pre_inspiratory_ratio)
          },
          "targets":{
            "ph":clean(r.pre_ph),
            "pco2":clean(r.pre_pco2),
            "po2":clean(r.pre_po2),
            "spo2":clean(r.pre_spo2),
            "vt_observed_ml":clean(r.pre_vt_observed),
            "minute_volume":clean(r.pre_minute_volume),
            "peak_pressure":clean(r.pre_peak_pressure),
            "plateau_pressure":clean(r.pre_plateau_pressure),
            "compliance_derived":clean(r.pre_compliance_derived),
            "compliance_documented":clean(r.pre_compliance_documented),
            "resistance":clean(r.pre_resistance)
          },
          "fit_status":{
            "compliance":clean(r.compliance_status),
            "resistance":clean(r.resistance_status),
            "shunt":clean(r.shunt_status),
            "dead_space":clean(r.dead_space_status),
            "recruitability":clean(r.recruitability_status)
          }
        }
        f.write(json.dumps(obj,separators=(",",":"))+"\n")
        written+=1

print("controlled_fit_inputs",written)
print("skipped_missing_vc_timing",skipped)
