#!/usr/bin/env python3
from pathlib import Path
import json, glob, collections, statistics, math, os

DER=Path("/Users/philipbernard/mimic-data/derived")
LOCKED=DER/"freeze3a_fio2_prefit_index.jsonl"
OUT=DER/"freeze3a_locked_refit.jsonl"

locked=[json.loads(x) for x in LOCKED.read_text().splitlines() if x.strip()]
locked_ids=[r["event_id"] for r in locked]
if len(locked)!=45 or len(set(locked_ids))!=45:
    raise RuntimeError("locked Freeze 3A index must contain exactly 45 unique events")

files=sorted(glob.glob(str(DER/"freeze3a_final_part*.jsonl")))
if len(files)!=9:
    raise RuntimeError(f"expected 9 final Freeze 3A part files, found {len(files)}")

rows=[]
for p in files:
    rows.extend(json.loads(x) for x in Path(p).read_text().splitlines() if x.strip())

ids=[r.get("event_id") for r in rows]
if len(rows)!=45:
    raise RuntimeError(f"expected 45 refit rows, found {len(rows)}")
if len(set(ids))!=45:
    raise RuntimeError("duplicate event IDs in final Freeze 3A refit")
if set(ids)!=set(locked_ids):
    raise RuntimeError("final Freeze 3A refit event set does not equal locked index")

by_id={r["event_id"]:r for r in rows}
ordered=[by_id[eid] for eid in locked_ids]

phenotype_commit=os.environ.get("PHENOTYPE_COMMIT")
if not phenotype_commit:
    raise RuntimeError("PHENOTYPE_COMMIT is required")
for r in ordered:
    r.setdefault("provenance",{})["phenotype_fit_commit"]=phenotype_commit

with OUT.open("w") as f:
    for r in ordered:
        f.write(json.dumps(r,separators=(",",":"))+"\n")

status=collections.Counter(r.get("status") for r in ordered)
complete=[r for r in ordered if r.get("status")=="fit-complete"]
passed=[r for r in complete if r.get("pass") is True]
print("rows",len(ordered))
print("status",dict(status))
print("fit_complete",len(complete))
print("pass",len(passed))
print("fail",len(complete)-len(passed))

fails=collections.Counter()
for r in complete:
    z=r["residuals"]
    if abs(z["baseline_pco2"])>8: fails["baseline_pco2"]+=1
    if abs(z["baseline_po2"])>20: fails["baseline_po2"]+=1
    if abs(z["drift_pco2_60"])>8: fails["drift_pco2_60"]+=1
    if abs(z["drift_po2_60"])>20: fails["drift_po2_60"]+=1
print("gate_fail_counts",dict(fails))

for key in ["baseline_pco2","baseline_po2","drift_pco2_60","drift_po2_60"]:
    vals=sorted(abs(r["residuals"][key]) for r in complete)
    if vals:
        p90=vals[max(0,math.ceil(.9*len(vals))-1)]
        print(key,"median_abs",round(statistics.median(vals),3),"p90_abs",round(p90,3))

for key in ["recruitment_p_close","baseline_recruitment_prior","dead_space_fraction_of_vt"]:
    print(key,dict(collections.Counter(r["fitted"].get(key) for r in complete)))
