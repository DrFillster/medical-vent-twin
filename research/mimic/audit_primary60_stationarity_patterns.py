#!/usr/bin/env python3
import json, math, statistics
from pathlib import Path

DER=Path("/Users/philipbernard/mimic-data/derived")
PREF=DER/"primary60_conservative_prefit.json"
REFIT=DER/"primary60_ps_fio2_composite_refit.jsonl"

pref={x["event_id"]:x for x in json.load(open(PREF))}
rows=[json.loads(x) for x in open(REFIT) if x.strip()]
data=[]
for r in rows:
    e=pref.get(r["event_id"])
    if not e:
        continue
    t=e["targets"]
    v=e["vent"]
    p=e["prefit"]
    data.append({
        "event_id":r["event_id"],
        "pass":bool(r["pass"]),
        "pco2":t.get("pco2"),
        "po2":t.get("po2"),
        "ph":t.get("ph"),
        "fio2":v.get("fio2_percent"),
        "peep":v.get("peep"),
        "psv":v.get("psv"),
        "rr":t.get("rr_total"),
        "vt":t.get("vt_observed_ml"),
        "mv":t.get("minute_volume"),
        "prefit_objective":p.get("objective"),
    })

print("rows",len(data))
print("pass",sum(x["pass"] for x in data))
print("fail",sum(not x["pass"] for x in data))

def med(vals):
    vals=[x for x in vals if x is not None and math.isfinite(x)]
    return None if not vals else statistics.median(vals)

for field in ["pco2","po2","ph","fio2","peep","rr","vt","mv","prefit_objective"]:
    print(field,
          "pass_median",med([x[field] for x in data if x["pass"]]),
          "fail_median",med([x[field] for x in data if not x["pass"]]))

rules=[
    ("pco2_ge50", lambda x: x["pco2"] is not None and x["pco2"]>=50),
    ("pco2_ge60", lambda x: x["pco2"] is not None and x["pco2"]>=60),
    ("ph_lt735", lambda x: x["ph"] is not None and x["ph"]<7.35),
    ("po2_ge150", lambda x: x["po2"] is not None and x["po2"]>=150),
    ("po2_ge180", lambda x: x["po2"] is not None and x["po2"]>=180),
]
for name,fn in rules:
    yes=[x for x in data if fn(x)]
    print(name,
          "n",len(yes),
          "pass",sum(x["pass"] for x in yes),
          "fail",sum(not x["pass"] for x in yes))

have_mv=[x for x in data if x["mv"] is not None and math.isfinite(x["mv"])]
print("mv_available",len(have_mv))
print("mv_pass_median",med([x["mv"] for x in have_mv if x["pass"]]))
print("mv_fail_median",med([x["mv"] for x in have_mv if not x["pass"]]))
