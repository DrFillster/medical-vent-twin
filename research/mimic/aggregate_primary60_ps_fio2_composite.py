#!/usr/bin/env python3
from pathlib import Path
import json, glob, collections, statistics, hashlib

DER=Path("/Users/philipbernard/mimic-data/derived")
LOCK=DER/"primary60_ps_fio2_prefit_index.jsonl"
OUT=DER/"primary60_ps_fio2_composite_refit.jsonl"

lock=[json.loads(x) for x in LOCK.read_text().splitlines() if x.strip()]
expected=[x["event_id"] for x in lock
          if x["oxygenation_source_plan"]=="composite_effective_oxygenation"]
if len(expected)!=19 or len(set(expected))!=19:
    raise RuntimeError("expected exactly 19 unique composite events")

parts=sorted(glob.glob(str(DER/"primary60_ps_fio2_composite_part*.jsonl")))
rows=[]
for p in parts:
    rows.extend(json.loads(x) for x in Path(p).read_text().splitlines() if x.strip())
ids=[x.get("event_id") for x in rows]
if len(rows)!=19 or len(set(ids))!=19 or set(ids)!=set(expected):
    raise RuntimeError("composite refit shards do not exactly match locked composite set")

by_id={x["event_id"]:x for x in rows}
ordered=[by_id[eid] for eid in expected]
if any(x.get("status")!="fit-complete" for x in ordered):
    raise RuntimeError("all composite events must be fit-complete before aggregation")

with OUT.open("w") as f:
    for x in ordered:
        f.write(json.dumps(x,separators=(",",":"))+"\n")

passed=[x for x in ordered if x.get("pass") is True]
fails=collections.Counter()
for x in ordered:
    r=x["residuals"]
    if abs(r["baseline_pco2"])>8: fails["baseline_pco2"]+=1
    if abs(r["baseline_po2"])>20: fails["baseline_po2"]+=1
    if abs(r["drift_pco2_60"])>8: fails["drift_pco2_60"]+=1
    if abs(r["drift_po2_60"])>20: fails["drift_po2_60"]+=1

print("rows",len(ordered))
print("pass",len(passed))
print("fail",len(ordered)-len(passed))
print("gate_fail_counts",dict(fails))
for key in ["baseline_pco2","baseline_po2","drift_pco2_60","drift_po2_60"]:
    vals=[abs(x["residuals"][key]) for x in ordered]
    print(key,"median_abs",round(statistics.median(vals),3),
          "max_abs",round(max(vals),3))
print("co2_nuisance_boundary",
      sum(x["boundary_flags"]["co2_nuisance"] for x in ordered))
print("oxygenation_boundary",
      sum(x["boundary_flags"]["oxygenation"] for x in ordered))
print("sha256",hashlib.sha256(OUT.read_bytes()).hexdigest())
print("output",OUT)
