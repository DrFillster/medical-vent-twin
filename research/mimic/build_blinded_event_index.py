#!/usr/bin/env python3
from pathlib import Path
import duckdb, json

DER=Path("/Users/philipbernard/mimic-data/derived")
IDX=DER/"fit_event_index.parquet"
FROZEN=DER/"frozen_phenotypes.parquet"
OUT=DER/"blinded_event_index.jsonl"

con=duckdb.connect()
rows=con.execute(f"""
SELECT
  f.event_id,
  f.fit_domain,
  f.representability,
  f.phenotype_schema_version,
  f.code_commit,
  i.hummod_mode,
  i.transition_itemid,
  i.transition_post_value
FROM read_parquet('{FROZEN}') f
JOIN read_parquet('{IDX}') i USING(event_id)
WHERE f.representability='well-represented'
  AND (
    i.transition_itemid IN (223835,220339)
    OR (i.transition_itemid=224688 AND i.hummod_mode IN ('VC_AC','PC_AC'))
    OR (i.transition_itemid=224684 AND i.hummod_mode='VC_AC')
  )
ORDER BY hash(f.event_id)
""").fetchall()

with OUT.open("w") as f:
    for r in rows:
        obj={
          "event_id":r[0],
          "fit_domain":r[1],
          "representability":r[2],
          "phenotype_schema_version":r[3],
          "code_commit":r[4],
          "hummod_mode":r[5],
          "transition_itemid":int(r[6]),
          "transition_post_value":r[7],
        }
        f.write(json.dumps(obj,separators=(",",":"))+"\n")

print("rows",len(rows))
print("well_represented",sum(r[2]=="well-represented" for r in rows))
print("output",OUT)
