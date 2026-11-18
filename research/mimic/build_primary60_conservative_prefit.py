#!/usr/bin/env python3
from pathlib import Path
import duckdb, json, glob

DER=Path("/Users/philipbernard/mimic-data/derived")
MAN=DER/"primary60_fit_manifest.parquet"
OUT=DER/"primary60_conservative_prefit.json"

# PS fits
psfits={}
for p in glob.glob(str(DER/"primary60_ps_effort_fit_batch_*.json")):
    for x in json.load(open(p)):
        b=x.get("best")
        if not b: continue
        if x.get("quality") not in ("strong","acceptable"): continue
        if (b["model"].get("asynchronyIndex") or 0)>0: continue
        psfits[x["event_id"]]=x

# Controlled fits
ctrl={}
with open(DER/"controlled_mechanics_fit.jsonl") as f:
    for line in f:
        if not line.strip(): continue
        x=json.loads(line)
        b=x.get("best")
        if b and b.get("objective") is not None and b["objective"]<=1.0:
            ctrl[x["event_id"]]=x

con=duckdb.connect()
rows=con.execute(f"""
select *
from read_parquet('{MAN}')
where mode_controller_ready
order by event_id
""").fetchdf()

out=[]
for _,r in rows.iterrows():
    eid=r.event_id
    mode=r.hummod_mode
    fit=None
    if mode=="PS" and eid in psfits:
        b=psfits[eid]["best"]
        fit={
          "fit_domain":"ps_effort_mechanics",
          "quality":psfits[eid]["quality"],
          "objective":float(b["objective"]),
          "drive":float(b["drive"]),
          "muscle_transmission":float(b["muscleTransmission"]),
          "stiffness_scale":float(b["stiffnessScale"]),
          "resistance_scale":1.0,
          "modeled_asynchrony_index":float(b["model"].get("asynchronyIndex") or 0)
        }
    elif mode in ("PC_AC","VC_AC") and eid in ctrl:
        b=ctrl[eid]["best"]
        fit={
          "fit_domain":"controlled_mechanics",
          "quality":"strong" if b["objective"]<=0.5 else "acceptable",
          "objective":float(b["objective"]),
          "drive":None,
          "muscle_transmission":None,
          "stiffness_scale":float(b["stiffnessScale"]),
          "resistance_scale":float(b["resistanceScale"]),
          "modeled_asynchrony_index":None
        }
    else:
        continue

    def val(name):
        v=r[name]
        try:
            if v!=v: return None
        except Exception:
            pass
        if hasattr(v,"item"): return v.item()
        return v

    out.append({
      "event_id":eid,
      "hummod_mode":mode,
      "transition_itemid":int(r.transition_itemid),
      "transition_pre_value":float(r.transition_pre_value),
      "transition_post_value":float(r.transition_post_value),
      "vent":{
        "fio2_percent":val("pre_fio2"),
        "peep":val("pre_peep"),
        "rr_set":val("pre_rr_set"),
        "vt_set_ml":val("pre_vt_set"),
        "psv":val("pre_psv"),
        "pinsp":val("pre_pinsp"),
        "flow_l_min":val("pre_flow_l_min"),
        "inspiratory_time_sec":val("pre_inspiratory_time_sec"),
        "inspiratory_ratio":val("pre_inspiratory_ratio")
      },
      "targets":{
        "ph":val("pre_ph"),
        "pco2":val("pre_pco2"),
        "po2":val("pre_po2"),
        "hr":val("pre_hr"),
        "map":val("pre_map"),
        "spo2":val("pre_spo2"),
        "vt_observed_ml":val("pre_vt_observed"),
        "minute_volume":val("pre_minute_volume"),
        "rr_total":val("pre_rr_total")
      },
      "measured_deadspace":{
        "quality":val("etco2_deadspace_quality"),
        "fraction":val("measured_paco2_petco2_fraction")
      },
      "oxygenation_source_plan":val("oxygenation_source_plan"),
      "has_preindex_peep_history":bool(r.has_preindex_peep_history),
      "prefit":fit
    })

json.dump(out,open(OUT,"w"),indent=2)
print("conservative_prefit",len(out))
from collections import Counter
print("modes",Counter(x["hummod_mode"] for x in out))
print("interventions",Counter(x["transition_itemid"] for x in out))
print("measured_deadspace",sum(x["measured_deadspace"]["quality"] in ("A","B") for x in out))
