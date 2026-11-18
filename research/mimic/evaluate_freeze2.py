#!/usr/bin/env python3
from pathlib import Path
import duckdb, json, math, hashlib
import numpy as np

DER=Path("/Users/philipbernard/mimic-data/derived")
OUTCOME=DER/"freeze2_outcome_bridge.parquet"
DENSE=DER/"freeze2_dense_frozen.jsonl"
PHENO=DER/"phenotype_inputs.parquet"
IDX=DER/"fit_event_index.parquet"
DETAIL=DER/"freeze2_evaluation_detail.jsonl"
SUMMARY=DER/"freeze2_evaluation_summary.json"

def split(event_id):
    v=int(hashlib.sha256(event_id.encode()).hexdigest()[:8],16)%10
    return "train" if v<=6 else "test"

def sgn(x):
    if x>0: return 1
    if x<0: return -1
    return 0

def interp(preds,t,key):
    rows=sorted(preds,key=lambda x:x["horizon_sec"])
    sec=t*60.0
    if sec<=rows[0]["horizon_sec"]: return rows[0][key]
    if sec>=rows[-1]["horizon_sec"]: return rows[-1][key]
    for a,b in zip(rows[:-1],rows[1:]):
        if a["horizon_sec"]<=sec<=b["horizon_sec"]:
            if sec==a["horizon_sec"]: return a[key]
            if sec==b["horizon_sec"]: return b[key]
            w=(sec-a["horizon_sec"])/(b["horizon_sec"]-a["horizon_sec"])
            return a[key]+w*(b[key]-a[key])
    raise RuntimeError("interpolation failure")

preds={}
for line in DENSE.read_text().splitlines():
    if line.strip():
        x=json.loads(line)
        preds[x["event_id"]]=x

con=duckdb.connect()
rows=con.execute(f"""
SELECT o.*,
       p.pre_fio2,p.pre_peep,p.pre_rr_set,p.pre_vt_set
FROM read_parquet('{OUTCOME}') o
LEFT JOIN read_parquet('{PHENO}') p
  ON p.stay_id=o.stay_id AND p.transition_time=o.transition_time
ORDER BY o.event_id
""").fetchdf()

details=[]
for _,r in rows.iterrows():
    eid=r.event_id
    pr=preds[eid]
    base={
      "event_id":eid,
      "split":split(eid),
      "mode":r.hummod_mode,
      "transition_itemid":int(r.transition_itemid),
      "transition_delta":float(r.transition_post_value-r.transition_pre_value),
      "post_abg_minutes":float(r.post_abg_minutes),
    }
    gas_specs=[
      ("paco2","pre_pco2","post_pco2","paco2_mmHg"),
      ("ph","pre_ph","post_ph","ph"),
      ("pao2","pre_po2","post_po2","pao2_mmHg"),
    ]
    for name,precol,postcol,pkey in gas_specs:
        pre=float(r[precol]); obs=float(r[postcol])
        hum=float(interp(pr["predictions"],r.post_abg_minutes,pkey))
        details.append({**base,"endpoint":name,"horizon_min":float(r.post_abg_minutes),
                        "pre":pre,"observed":obs,"hummod":hum,"persistence":pre})
    for h in (15,30,60):
        for name,precol,postcol,pkey in [
          ("hr","pre_hr",f"post_hr_{h}","hr_per_min"),
          ("map","pre_map",f"post_map_{h}","map_mmHg"),
          ("spo2","pre_spo2",f"post_spo2_{h}","sao2_percent"),
        ]:
            val=r[postcol]
            if val is None or (isinstance(val,float) and math.isnan(val)): continue
            pre=float(r[precol]); obs=float(val)
            hum=float(interp(pr["predictions"],h,pkey))
            details.append({**base,"endpoint":name,"horizon_min":h,
                            "pre":pre,"observed":obs,"hummod":hum,"persistence":pre})

# Train-only population mean delta by endpoint/horizon/intervention.
from collections import defaultdict
grp=defaultdict(list); global_delta=defaultdict(list)
for d in details:
    if d["split"]!="train": continue
    k=(d["endpoint"],d["horizon_min"] if d["endpoint"] in ("hr","map","spo2") else "gas",
       d["transition_itemid"])
    grp[k].append(d["observed"]-d["pre"])
    kg=(d["endpoint"],d["horizon_min"] if d["endpoint"] in ("hr","map","spo2") else "gas")
    global_delta[kg].append(d["observed"]-d["pre"])

for d in details:
    k=(d["endpoint"],d["horizon_min"] if d["endpoint"] in ("hr","map","spo2") else "gas",
       d["transition_itemid"])
    kg=(d["endpoint"],d["horizon_min"] if d["endpoint"] in ("hr","map","spo2") else "gas")
    ds=grp.get(k) or global_delta.get(kg) or [0.0]
    d["population"]=d["pre"]+float(np.mean(ds))

# Simple held-out OLS: delta ~ pre + intervention delta + mode + intervention type + time.
modes=["VC_AC","PC_AC","PS"]
items=[220339,223835,224684,224688]
def features(d):
    x=[1.0,d["pre"],d["transition_delta"]]
    x += [1.0 if d["mode"]==m else 0.0 for m in modes]
    x += [1.0 if d["transition_itemid"]==i else 0.0 for i in items]
    x += [float(d["horizon_min"])/60.0]
    return x

groups=defaultdict(list)
for d in details:
    hk=d["horizon_min"] if d["endpoint"] in ("hr","map","spo2") else "gas"
    groups[(d["endpoint"],hk)].append(d)

for key,ds in groups.items():
    tr=[d for d in ds if d["split"]=="train"]
    if len(tr)>=len(features(tr[0]))+2:
        X=np.asarray([features(d) for d in tr],float)
        y=np.asarray([d["observed"]-d["pre"] for d in tr],float)
        beta=np.linalg.lstsq(X,y,rcond=None)[0]
        for d in ds:
            d["empirical"]=d["pre"]+float(np.dot(np.asarray(features(d)),beta))
    else:
        for d in ds: d["empirical"]=None

def metrics(ds,predkey):
    pairs=[d for d in ds if d.get(predkey) is not None and math.isfinite(float(d[predkey]))]
    if not pairs: return None
    err=np.asarray([d[predkey]-d["observed"] for d in pairs],float)
    ae=np.abs(err)
    dir_ok=[sgn(d[predkey]-d["pre"])==sgn(d["observed"]-d["pre"]) for d in pairs]
    return {
      "n":len(pairs),
      "mae":float(np.mean(ae)),
      "median_ae":float(np.median(ae)),
      "bias":float(np.mean(err)),
      "direction_accuracy":float(np.mean(dir_ok)),
    }

summary={"freeze":"Freeze 2","n_events":len(preds),"split_counts":{},"primary":{},"test_baselines":{}}
for sp in ("train","test"):
    summary["split_counts"][sp]=len({d["event_id"] for d in details if d["split"]==sp})

# Full frozen cohort HumMod vs persistence.
for endpoint in ("paco2","ph","pao2"):
    ds=[d for d in details if d["endpoint"]==endpoint]
    summary["primary"][endpoint]={"hummod":metrics(ds,"hummod"),"persistence":metrics(ds,"persistence")}
for endpoint in ("hr","map","spo2"):
    for h in (15,30,60):
        ds=[d for d in details if d["endpoint"]==endpoint and d["horizon_min"]==h]
        summary["primary"][f"{endpoint}_{h}"]={"hummod":metrics(ds,"hummod"),"persistence":metrics(ds,"persistence")}

# Held-out comparisons.
for endpoint in ("paco2","ph","pao2"):
    ds=[d for d in details if d["endpoint"]==endpoint and d["split"]=="test"]
    summary["test_baselines"][endpoint]={k:metrics(ds,k) for k in ("hummod","persistence","population","empirical")}
for endpoint in ("hr","map","spo2"):
    for h in (15,30,60):
        ds=[d for d in details if d["endpoint"]==endpoint and d["horizon_min"]==h and d["split"]=="test"]
        summary["test_baselines"][f"{endpoint}_{h}"]={k:metrics(ds,k) for k in ("hummod","persistence","population","empirical")}

DETAIL.write_text("\n".join(json.dumps(d,separators=(",",":")) for d in details)+"\n")
SUMMARY.write_text(json.dumps(summary,indent=2)+"\n")
print(json.dumps(summary,indent=2))
