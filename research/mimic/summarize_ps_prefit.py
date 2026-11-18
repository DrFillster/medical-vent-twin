#!/usr/bin/env python3
from pathlib import Path
import json, math, statistics
from collections import Counter

DER=Path("/Users/philipbernard/mimic-data/derived")
PARTS=sorted(DER.glob("ps_fit_full_part*.jsonl"))
INPUT=DER/"ps_fit_inputs.jsonl"

def quantiles(values, probs):
    xs=sorted(x for x in values if isinstance(x,(int,float)) and math.isfinite(x))
    if not xs: return [None]*len(probs)
    out=[]
    for p in probs:
        pos=(len(xs)-1)*p
        lo=math.floor(pos); hi=math.ceil(pos)
        out.append(xs[lo] if lo==hi else xs[lo]*(hi-pos)+xs[hi]*(pos-lo))
    return out

def median_numeric(values):
    xs=[x for x in values if isinstance(x,(int,float)) and math.isfinite(x)]
    return statistics.median(xs) if xs else None

rows=[]
for p in PARTS:
    if not p.exists(): continue
    rows.extend(json.loads(line) for line in p.read_text().splitlines() if line.strip())

inputs={}
if INPUT.exists():
    inputs={r["event_id"]:r for r in
            (json.loads(line) for line in INPUT.read_text().splitlines() if line.strip())}

complete=[r for r in rows if r.get("status")=="fit-complete"]
failed=[r for r in rows if r.get("status")!="fit-complete"]

print("parts",len(PARTS))
print("rows",len(rows))
print("fit_complete",len(complete))
print("fit_failed",len(failed))
print("profiles",dict(Counter(r["fitted"]["effort_profile"] for r in complete)))
print("drive_grid",dict(Counter(str(r["fitted"]["hennigs_drive_relative"]) for r in complete)))

for key in ["effort","gas","combined"]:
    vals=[r["scores"][key] for r in complete]
    print(key+"_q25_50_75_90_95_99",
          quantiles(vals,[.25,.5,.75,.9,.95,.99]))

for key in ["rr","vt_ml","minute_volume","po2","pco2","ph","spo2"]:
    vals=[abs(r["residuals"][key]) for r in complete
          if r.get("residuals") and isinstance(r["residuals"].get(key),(int,float))
          and math.isfinite(r["residuals"][key])]
    print("abs_"+key+"_q50_75_90_95",quantiles(vals,[.5,.75,.9,.95]))

print("quality_counts",{
    "effort_le2":sum(r["scores"]["effort"]<=2 for r in complete),
    "effort_gt10":sum(r["scores"]["effort"]>10 for r in complete),
    "gas_le2":sum(r["scores"]["gas"]<=2 for r in complete),
    "gas_gt10":sum(r["scores"]["gas"]>10 for r in complete),
    "both_effort_gas_le2":sum(
        r["scores"]["effort"]<=2 and r["scores"]["gas"]<=2 for r in complete
    ),
    "either_effort_gas_gt10":sum(
        r["scores"]["effort"]>10 or r["scores"]["gas"]>10 for r in complete
    ),
})

def subgroup(label, predicate):
    subset=[r for r in complete if predicate(r)]
    source=[inputs[r["event_id"]] for r in subset if r["event_id"] in inputs]
    def t(key):
        return median_numeric([x["targets"].get(key) for x in source])
    def v(key):
        return median_numeric([x["vent"].get(key) for x in source])
    print(label,{
        "n":len(subset),
        "fio2_percent_median":v("fio2_percent"),
        "peep_median":v("peep"),
        "pressure_support_median":v("pressure_support"),
        "rr_target_median":median_numeric([
            x["targets"].get("rr_total")
            if isinstance(x["targets"].get("rr_total"),(int,float))
            else x["targets"].get("rr_spontaneous")
            for x in source
        ]),
        "vt_observed_ml_median":t("vt_observed_ml"),
        "minute_volume_median":t("minute_volume"),
        "po2_median":t("po2"),
        "pco2_median":t("pco2"),
    })

subgroup("effort_gt10",lambda r:r["scores"]["effort"]>10)
subgroup("effort_le10",lambda r:r["scores"]["effort"]<=10)
subgroup("gas_gt10",lambda r:r["scores"]["gas"]>10)
subgroup("gas_le10",lambda r:r["scores"]["gas"]<=10)
