#!/usr/bin/env python3
from pathlib import Path
import json, glob, hashlib

DER=Path("/Users/philipbernard/mimic-data/derived")
INDEX=DER/"freeze3a_event_index.jsonl"
OUT=DER/"freeze3a_predictions_frozen.jsonl"

index=[json.loads(x) for x in INDEX.read_text().splitlines() if x.strip()]
index_ids=[r["event_id"] for r in index]
if len(index_ids)!=12 or len(set(index_ids))!=12:
    raise RuntimeError("Freeze 3A prediction index must contain exactly 12 unique events")

parts=sorted(glob.glob(str(DER/"freeze3a_predictions_part*.jsonl")))
if len(parts)!=3:
    raise RuntimeError(f"expected 3 Freeze 3A prediction shards, found {len(parts)}")

rows=[]
for p in parts:
    rows.extend(json.loads(x) for x in Path(p).read_text().splitlines() if x.strip())

ids=[r.get("event_id") for r in rows]
if len(rows)!=12 or len(set(ids))!=12:
    raise RuntimeError("Freeze 3A prediction shards must contain exactly 12 unique rows")
if set(ids)!=set(index_ids):
    raise RuntimeError("Freeze 3A prediction event set does not match locked prediction index")

by_id={r["event_id"]:r for r in rows}
ordered=[by_id[eid] for eid in index_ids]

commits=set()
for r in ordered:
    if r.get("status")!="predicted":
        raise RuntimeError(f"non-predicted Freeze 3A row: {r.get('event_id')}")
    preds=r.get("predictions") or []
    if len(preds)!=12:
        raise RuntimeError(f"expected 12 horizons for {r['event_id']}, got {len(preds)}")
    horizons=[p.get("horizon_sec") for p in preds]
    expected=[300*i for i in range(1,13)]
    if horizons!=expected:
        raise RuntimeError(f"unexpected horizons for {r['event_id']}: {horizons}")
    prov=r.get("provenance") or {}
    if prov.get("post_outcome_data_loaded") is not False:
        raise RuntimeError(f"outcome-load provenance violation for {r['event_id']}")
    commits.add(prov.get("prediction_runtime_commit"))

if len(commits)!=1:
    raise RuntimeError(f"prediction shards have inconsistent runtime commits: {commits}")

with OUT.open("w") as f:
    for r in ordered:
        f.write(json.dumps(r,separators=(",",":"))+"\n")

sha=hashlib.sha256(OUT.read_bytes()).hexdigest()
print("rows",len(ordered))
print("unique",len(set(index_ids)))
print("status_predicted",sum(r["status"]=="predicted" for r in ordered))
print("horizons_per_event",len(ordered[0]["predictions"]))
print("final_horizon_sec",ordered[0]["predictions"][-1]["horizon_sec"])
print("prediction_runtime_commit",next(iter(commits)))
print("sha256",sha)
print("output",OUT)
