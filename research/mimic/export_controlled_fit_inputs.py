#!/usr/bin/env python3
from pathlib import Path
import duckdb, json, hashlib, pandas as pd

DER=Path("/Users/philipbernard/mimic-data/derived")
SRC=DER/"phenotype_fit_plan.parquet"
TIMING=DER/"vent_timing_flow_events.parquet"
OUT=DER/"controlled_fit_inputs.jsonl"

con=duckdb.connect()
rows=con.execute(f"""
WITH e AS (
 SELECT *
 FROM read_parquet('{SRC}')
 WHERE eligible_for_primary_prefit
   AND hummod_mode IN ('VC_AC','PC_AC')
),
x AS (
 SELECT e.*,
   (SELECT valuenum FROM read_parquet('{TIMING}') t
    WHERE t.stay_id=e.stay_id AND t.itemid=224691
      AND t.charttime BETWEEN e.transition_time-INTERVAL '2 hours' AND e.transition_time
      AND t.valuenum IS NOT NULL
    ORDER BY t.charttime DESC,t.storetime DESC LIMIT 1) pre_flow_l_min,
   (SELECT valuenum FROM read_parquet('{TIMING}') t
    WHERE t.stay_id=e.stay_id AND t.itemid=224738
      AND t.charttime BETWEEN e.transition_time-INTERVAL '2 hours' AND e.transition_time
      AND t.valuenum IS NOT NULL
    ORDER BY t.charttime DESC,t.storetime DESC LIMIT 1) pre_inspiratory_time_sec,
   (SELECT valuenum FROM read_parquet('{TIMING}') t
    WHERE t.stay_id=e.stay_id AND t.itemid=226873
      AND t.charttime BETWEEN e.transition_time-INTERVAL '2 hours' AND e.transition_time
      AND t.valuenum IS NOT NULL
    ORDER BY t.charttime DESC,t.storetime DESC LIMIT 1) pre_inspiratory_ratio
 FROM e
)
SELECT * FROM x
ORDER BY hash(stay_id,transition_time,transition_itemid)
""").fetchdf()

def clean(v):
    if v is None or pd.isna(v): return None
    if hasattr(v,"isoformat"): return v.isoformat()
    if hasattr(v,"item"): return v.item()
    return v

eligible=0
with OUT.open("w") as f:
    for _,r in rows.iterrows():
        rr=clean(r.pre_rr_set)
        vt_ml=clean(r.pre_vt_set)
        flow_l_min=clean(r.pre_flow_l_min)
        ti=clean(r.pre_inspiratory_time_sec)
        iratio=clean(r.pre_inspiratory_ratio)

        # For VC, prefer recorded flow. If absent, derive flow only from
        # recorded Ti or recorded inspiratory ratio plus set RR.
        flow_lps = flow_l_min/60.0 if flow_l_min is not None and flow_l_min>0 else None
        if r.hummod_mode=="VC_AC" and flow_lps is None and vt_ml and vt_ml>0:
            if ti is not None and ti>0:
                flow_lps=(vt_ml/1000.0)/ti
            elif iratio is not None and iratio>0 and rr is not None and rr>0:
                cycle=60.0/rr
                ti_from_ratio=cycle*(iratio/(1.0+iratio))
                if ti_from_ratio>0: flow_lps=(vt_ml/1000.0)/ti_from_ratio

        controller_complete = (
            (r.hummod_mode=="VC_AC" and rr and vt_ml and flow_lps) or
            (r.hummod_mode=="PC_AC" and rr and clean(r.pre_pinsp) is not None and ti is not None and ti>0)
        )
        if not controller_complete:
            continue

        raw=f"{int(r.stay_id)}|{r.transition_time}|{int(r.transition_itemid)}"
        eid="FIT-"+hashlib.sha256(raw.encode()).hexdigest()[:12]
        obj={
          "event_id":eid,
          "hummod_mode":clean(r.hummod_mode),
          "vent":{
            "fio2_percent":clean(r.pre_fio2),
            "peep":clean(r.pre_peep),
            "rr_set":rr,
            "vt_set_ml":vt_ml,
            "pinsp":clean(r.pre_pinsp),
            "flow_lps":flow_lps,
            "inspiratory_time_sec":ti,
            "inspiratory_ratio":iratio,
          },
          "targets":{
            "ph":clean(r.pre_ph),"pco2":clean(r.pre_pco2),"po2":clean(r.pre_po2),
            "spo2":clean(r.pre_spo2),"hr":clean(r.pre_hr),"map":clean(r.pre_map),
            "vt_observed_ml":clean(r.pre_vt_observed),"minute_volume":clean(r.pre_minute_volume),
            "peak_pressure":clean(r.pre_peak_pressure),"plateau_pressure":clean(r.pre_plateau_pressure),
            "compliance_derived":clean(r.pre_compliance_derived),
            "compliance_documented":clean(r.pre_compliance_documented),
            "resistance":clean(r.pre_resistance),
            "rr_total":clean(r.pre_rr_total),
            "rr_spontaneous":clean(r.pre_rr_spontaneous),
          },
          "fit_status":{
            "compliance":clean(r.compliance_status),"resistance":clean(r.resistance_status),
            "shunt":clean(r.shunt_status),"dead_space":clean(r.dead_space_status),
            "recruitability":clean(r.recruitability_status),
          }
        }
        f.write(json.dumps(obj,separators=(",",":"))+"\n")
        eligible+=1

print("controlled_fit_inputs",eligible)
