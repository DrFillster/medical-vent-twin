#!/usr/bin/env python3
from pathlib import Path
import json, duckdb

DER=Path("/Users/philipbernard/mimic-data/derived")
LOCKED=DER/"freeze3a_fio2_prefit_index.jsonl"
REFIT=DER/"freeze3a_locked_refit.jsonl"
FIT_INDEX=DER/"fit_event_index.parquet"
OUT=DER/"freeze3a_event_index.jsonl"

locked=[json.loads(x) for x in LOCKED.read_text().splitlines() if x.strip()]
locked_map={r["event_id"]:r for r in locked}
refits=[json.loads(x) for x in REFIT.read_text().splitlines() if x.strip()]
eligible=[r for r in refits if r.get("status")=="fit-complete" and r.get("pass") is True]

ids=[r["event_id"] for r in eligible]
if len(ids)!=len(set(ids)):
    raise RuntimeError("duplicate eligible Freeze 3A IDs")

con=duckdb.connect()
if ids:
    placeholders=",".join("?" for _ in ids)
    rows=con.execute(f"""
      SELECT event_id,transition_itemid,transition_post_value
      FROM read_parquet('{FIT_INDEX}')
      WHERE event_id IN ({placeholders})
    """,ids).fetchall()
else:
    rows=[]
bridge={r[0]:(int(r[1]),r[2]) for r in rows}

with OUT.open("w") as f:
    for r in eligible:
        eid=r["event_id"]
        if eid not in bridge:
            raise RuntimeError(f"missing intervention bridge for {eid}")
        itemid,post=bridge[eid]
        if itemid!=223835:
            raise RuntimeError("Freeze 3A eligible event is not FiO2")
        lock=locked_map[eid]
        obj={
          "event_id":eid,
          "fit_domain":"PS",
          "hummod_mode":"PS",
          "pre_mode":lock["pre_mode"],
          "effort_score":lock["effort_score"],
          "transition_itemid":itemid,
          "transition_post_value":post,
          "baseline_fidelity_pass":True,
          "stationarity_pass":True,
          "refit_provenance":r.get("provenance",{})
        }
        f.write(json.dumps(obj,separators=(",",":"))+"\n")

print("eligible",len(eligible))
print("index_rows",len(ids))
