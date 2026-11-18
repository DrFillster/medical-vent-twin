#!/usr/bin/env python3
from pathlib import Path
import json, math

SRC=Path("/Users/philipbernard/mimic-data/derived/controlled_mechanics_fit.jsonl")
OUT=Path("/Users/philipbernard/mimic-data/derived/controlled_mechanics_fit_qc.jsonl")

rows=[]
for line in SRC.read_text().splitlines():
    if not line.strip(): continue
    r=json.loads(line)
    b=r.get("best")
    if not b:
        r["qc_status"]="no_usable_mechanics_target"
        r["boundary_constrained"]=None
        r["eligible_for_gas_fit"]=False
    else:
        obj=b.get("objective")
        boundary=(
            b.get("stiffnessScale") in (0.4,2.5) or
            b.get("resistanceScale") in (0.25,4.0) or
            b.get("recruitableFraction") in (0.05,0.9)
        )
        r["boundary_constrained"]=boundary
        if not isinstance(obj,(int,float)) or not math.isfinite(obj):
            r["qc_status"]="invalid_objective"
            r["eligible_for_gas_fit"]=False
        elif obj<=0.5 and not boundary:
            r["qc_status"]="good_interior_fit"
            r["eligible_for_gas_fit"]=True
        elif obj<=1.0:
            r["qc_status"]="usable_but_weakly_constrained"
            r["eligible_for_gas_fit"]=True
        else:
            r["qc_status"]="poor_mechanics_fit"
            r["eligible_for_gas_fit"]=False
    rows.append(r)

OUT.write_text("\n".join(json.dumps(r,separators=(",",":")) for r in rows)+"\n")
from collections import Counter
print(Counter(r["qc_status"] for r in rows))
print("eligible_for_gas_fit",sum(r["eligible_for_gas_fit"] for r in rows))
print("boundary_constrained",sum(r.get("boundary_constrained") is True for r in rows))
