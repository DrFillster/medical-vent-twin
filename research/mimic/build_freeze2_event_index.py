#!/usr/bin/env python3
from pathlib import Path
import json, duckdb

DER=Path("/Users/philipbernard/mimic-data/derived")
GATE=DER/"freeze2_stationarity_gate.jsonl"
IDX=DER/"fit_event_index.parquet"
OUT=DER/"freeze2_event_index.jsonl"

gate={}
for line in GATE.read_text().splitlines():
    if not line.strip(): continue
    r=json.loads(line)
    if not r.get("stationarity_pass"): continue
    if r.get("pre_mode") not in ("SPONT","CPAP/PSV","PSV/SBT"): continue
    if r.get("transition_itemid") not in (223835,220339): continue
    gate[r["event_id"]]=r

con=duckdb.connect()
ids=list(gate)
if not ids:
    raise RuntimeError("no Freeze 2 stationarity-pass events")
placeholders=",".join("?" for _ in ids)
rows=con.execute(f"""
SELECT event_id,transition_post_value
FROM read_parquet('{IDX}')
WHERE event_id IN ({placeholders})
""",ids).fetchall()
post=dict(rows)

with OUT.open("w") as f:
    for eid in sorted(ids):
        r=gate[eid]
        if eid not in post:
            raise RuntimeError(f"missing transition post value for {eid}")
        obj={
          "event_id":eid,
          "fit_domain":r["fit_domain"],
          "hummod_mode":r["hummod_mode"],
          "transition_itemid":int(r["transition_itemid"]),
          "transition_post_value":post[eid],
          "phenotype_schema_version":r["phenotype_schema_version"],
          "code_commit":r["code_commit"],
          "stationarity_pass":True,
          "pre_mode":r["pre_mode"],
        }
        f.write(json.dumps(obj,separators=(",",":"))+"\n")

print("rows",len(ids))
