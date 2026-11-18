#!/usr/bin/env python3
from pathlib import Path
import json, math, duckdb

DER=Path("/Users/philipbernard/mimic-data/derived")
parts=[DER/f"freeze2_stationarity_part{i}.jsonl" for i in range(13)]
idx=DER/"freeze2_stationarity_candidates.jsonl"
out=DER/"freeze2_stationarity_gate.jsonl"

meta={}
for line in idx.read_text().splitlines():
    if line.strip():
        x=json.loads(line); meta[x["event_id"]]=x

rows=[]
for p in parts:
    for line in p.read_text().splitlines():
        if not line.strip(): continue
        x=json.loads(line)
        m=meta[x["event_id"]]
        rec={**m,"stationarity_status":x.get("status")}
        if x.get("status")=="ok":
            b=x["baseline"]
            s60=next(z for z in x["trajectory"] if z["horizon_sec"]==3600)
            dpco2=s60["paco2_mmHg"]-b["paco2_mmHg"]
            dpao2=s60["pao2_mmHg"]-b["pao2_mmHg"]
            dph=s60["ph"]-b["ph"]
            rec.update({
              "delta_paco2_60":dpco2,
              "delta_pao2_60":dpao2,
              "delta_ph_60":dph,
              "stationarity_pass":abs(dpco2)<=8 and abs(dpao2)<=20
            })
        else:
            rec.update({"delta_paco2_60":None,"delta_pao2_60":None,"delta_ph_60":None,"stationarity_pass":False})
        rows.append(rec)

out.write_text("\n".join(json.dumps(r,separators=(",",":")) for r in rows)+"\n")
print("rows",len(rows))
print("runtime_ok",sum(r["stationarity_status"]=="ok" for r in rows))
print("pass",sum(r["stationarity_pass"] for r in rows))
from collections import Counter
print("by_mode")
for k,v in sorted(Counter((r["hummod_mode"],r["stationarity_pass"]) for r in rows).items()):
    print(k,v)
print("by_pre_mode")
for k,v in sorted(Counter((r["pre_mode"],r["stationarity_pass"]) for r in rows).items(),key=lambda kv:(kv[0][0],kv[0][1])):
    print(k,v)
