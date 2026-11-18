#!/usr/bin/env python3
from pathlib import Path
import json, math
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

DER=Path("/Users/philipbernard/mimic-data/derived")
INPUTS=DER/"controlled_fit_inputs.jsonl"
FITS=DER/"controlled_mechanics_fit.jsonl"
OUT=DER/"controlled_mechanics_phenotypes.parquet"

inputs={r["event_id"]:r for r in map(json.loads, INPUTS.open())}
fits=[json.loads(x) for x in FITS.open() if x.strip()]
rows=[]

for f in fits:
    i=inputs.get(f["event_id"])
    if i is None:
        continue
    best=f.get("best")
    obj=(best or {}).get("objective")
    valid=isinstance(obj,(int,float)) and math.isfinite(obj)

    rr_total=i["targets"].get("rr_total")
    rr_set=i["vent"].get("rr_set")
    rr_spont=i["targets"].get("rr_spontaneous")
    controller_compatible=(
        rr_total is not None and rr_set is not None
        and abs(rr_total-rr_set)<=2
        and (rr_spont is None or rr_spont<=2)
    )

    if not valid:
        quality="unfitted"
    elif obj < 0.1:
        quality="excellent"
    elif obj < 0.5:
        quality="good"
    elif obj < 1.0:
        quality="fair"
    else:
        quality="poor"

    rows.append({
        "event_id":f["event_id"],
        "hummod_mode":f["mode"],
        "controller_compatible":controller_compatible,
        "mechanics_fit_valid":valid,
        "mechanics_fit_quality":quality,
        "mechanics_objective":obj if valid else None,
        "stiffness_scale":(best or {}).get("stiffnessScale"),
        "resistance_scale":(best or {}).get("resistanceScale"),
        "resistance_fitted":bool(f.get("canFitResistance")),
        "stiffness_boundary_hit":valid and (best["stiffnessScale"] in (0.4,2.5)),
        "resistance_boundary_hit":valid and bool(f.get("canFitResistance"))
            and (best["resistanceScale"] in (0.25,4.0)),
        "rr_set":rr_set,
        "rr_total":rr_total,
        "rr_spontaneous":rr_spont,
        "transition_itemid":None,
    })

df=pd.DataFrame(rows)
pq.write_table(pa.Table.from_pandas(df,preserve_index=False),OUT,compression="zstd")

print("rows",len(df))
print("controller_compatible",int(df.controller_compatible.sum()))
print("controller_compatible_valid",int((df.controller_compatible & df.mechanics_fit_valid).sum()))
print("compatible_by_mode")
print(df[df.controller_compatible].groupby("hummod_mode").size().to_dict())
print("quality",df.mechanics_fit_quality.value_counts().to_dict())
print("compatible_quality",df[df.controller_compatible].mechanics_fit_quality.value_counts().to_dict())
