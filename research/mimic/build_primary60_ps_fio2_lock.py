#!/usr/bin/env python3
from pathlib import Path
import json, hashlib

DER=Path("/Users/philipbernard/mimic-data/derived")
SRC=DER/"primary60_conservative_prefit.json"
OUT=DER/"primary60_ps_fio2_prefit_index.jsonl"

rows=json.load(open(SRC))
locked=[]
for e in rows:
    if e["hummod_mode"]!="PS": continue
    if e["transition_itemid"]!=223835: continue
    p=e["prefit"]
    if p["quality"] not in ("strong","acceptable"):
        raise RuntimeError(f"unexpected effort quality for {e['event_id']}")
    if float(p.get("modeled_asynchrony_index") or 0)!=0:
        raise RuntimeError(f"nonzero modeled asynchrony in locked event {e['event_id']}")
    locked.append({
      "event_id":e["event_id"],
      "hummod_mode":"PS",
      "transition_itemid":223835,
      "transition_pre_value":e["transition_pre_value"],
      "transition_post_value":e["transition_post_value"],
      "effort_mechanics_quality":p["quality"],
      "effort_mechanics_objective":p["objective"],
      "drive":p["drive"],
      "muscle_transmission":p["muscle_transmission"],
      "stiffness_scale":p["stiffness_scale"],
      "resistance_scale":p["resistance_scale"],
      "deadspace_source_plan":"measured_etco2" if
          e["measured_deadspace"]["quality"] in ("A","B")
          else "latent_prior_constrained",
      "measured_deadspace_quality":e["measured_deadspace"]["quality"],
      "measured_deadspace_fraction":e["measured_deadspace"]["fraction"],
      "oxygenation_source_plan":e["oxygenation_source_plan"],
      "has_preindex_peep_history":bool(e["has_preindex_peep_history"]),
    })

locked=sorted(locked,key=lambda x:x["event_id"])
ids=[x["event_id"] for x in locked]
if len(locked)!=24 or len(set(ids))!=24:
    raise RuntimeError(f"expected exactly 24 unique PS FiO2 events, got {len(locked)}")
if any(x["deadspace_source_plan"]=="measured_etco2" for x in locked):
    raise RuntimeError("current 24-event lock unexpectedly contains measured A/B EtCO2")
if sum(x["has_preindex_peep_history"] for x in locked)!=5:
    raise RuntimeError("expected 5 pre-index PEEP-history events")
if sum(x["oxygenation_source_plan"]=="composite_effective_oxygenation" for x in locked)!=19:
    raise RuntimeError("expected 19 composite-oxygenation events")
if sum(x["oxygenation_source_plan"]=="history_decomposable" for x in locked)!=5:
    raise RuntimeError("expected 5 history-decomposable events")

with OUT.open("w") as f:
    for x in locked:
        f.write(json.dumps(x,separators=(",",":"))+"\n")

sha=hashlib.sha256(OUT.read_bytes()).hexdigest()
print("rows",len(locked))
print("unique",len(set(ids)))
print("composite_oxygenation",sum(x["oxygenation_source_plan"]=="composite_effective_oxygenation" for x in locked))
print("history_decomposable",sum(x["oxygenation_source_plan"]=="history_decomposable" for x in locked))
print("measured_deadspace",sum(x["deadspace_source_plan"]=="measured_etco2" for x in locked))
print("sha256",sha)
print("output",OUT)
