#!/usr/bin/env python3
from pathlib import Path
import duckdb, json, math

DER=Path("/Users/philipbernard/mimic-data/derived")
BLIND=DER/"blinded_primary_prediction_inputs.parquet"
FIT=DER/"controlled_mechanics_fit.jsonl"
OUT=DER/"controlled_blinded_fit_ready.json"

con=duckdb.connect()
rows=con.execute(f"""
select *
from read_parquet('{BLIND}')
where hummod_mode in ('PC_AC','VC_AC')
order by event_id
""").fetchdf()

fits={}
for line in open(FIT):
    if not line.strip():
        continue
    r=json.loads(line)
    best=r.get("best") or {}
    obj=best.get("objective")
    if isinstance(obj,(int,float)) and math.isfinite(obj) and obj<=1.0:
        fits[r["event_id"]]=r

out=[]
for _,r in rows.iterrows():
    eid=r["event_id"]
    if eid not in fits:
        continue
    def c(v):
        try:
            import pandas as pd
            if pd.isna(v): return None
        except Exception:
            pass
        if hasattr(v,"item"): return v.item()
        return v
    d={k:c(v) for k,v in r.to_dict().items()}
    f=fits[eid]
    d["mechanics_fit"]={
      "objective":f["best"]["objective"],
      "stiffnessScale":f["best"]["stiffnessScale"],
      "resistanceScale":f["best"]["resistanceScale"],
      "initialRecruitmentStateRecruitable":
        f["best"].get("initialRecruitmentStateRecruitable",
                      f["best"].get("recruitableFraction",0.35)),
    }
    out.append(d)

json.dump(out,open(OUT,"w"),indent=2)
print("rows",len(out))
print("modes",{
  m:sum(1 for x in out if x["hummod_mode"]==m)
  for m in ["PC_AC","VC_AC"]
})
print("interventions",{
  k:sum(1 for x in out if x["intervention_type"]==k)
  for k in ["FIO2","PEEP"]
})
