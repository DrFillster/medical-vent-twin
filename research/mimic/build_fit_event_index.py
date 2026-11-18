#!/usr/bin/env python3
from pathlib import Path
import duckdb, hashlib

DER=Path("/Users/philipbernard/mimic-data/derived")
SRC=DER/"phenotype_fit_plan.parquet"
OUT=DER/"fit_event_index.parquet"

con=duckdb.connect()

# Keep this index local. It contains MIMIC identifiers/timestamps and is never
# committed to Git. event_id is the stable bridge to de-identified fit outputs.
rows=con.execute(f"""
SELECT *
FROM read_parquet('{SRC}')
WHERE eligible_for_primary_prefit
  AND hummod_mode IN ('VC_AC','PC_AC','PS')
""").fetchdf()

records=[]
for _,r in rows.iterrows():
    prefix="PSFIT" if r.hummod_mode=="PS" else "FIT"
    raw=f"{int(r.stay_id)}|{r.transition_time}|{int(r.transition_itemid)}"
    eid=prefix+"-"+hashlib.sha256(raw.encode()).hexdigest()[:12]
    records.append((
        eid,
        int(r.subject_id),
        int(r.hadm_id),
        int(r.stay_id),
        r.transition_time,
        int(r.transition_itemid),
        r.hummod_mode,
        r.transition_pre_value,
        r.transition_post_value,
    ))

con.execute("""
CREATE OR REPLACE TABLE event_index(
  event_id VARCHAR,
  subject_id BIGINT,
  hadm_id BIGINT,
  stay_id BIGINT,
  transition_time TIMESTAMP,
  transition_itemid BIGINT,
  hummod_mode VARCHAR,
  transition_pre_value DOUBLE,
  transition_post_value DOUBLE
)
""")
con.executemany("INSERT INTO event_index VALUES (?,?,?,?,?,?,?,?,?)",records)
con.execute(f"COPY event_index TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)")

print("event_index_rows",len(records))
print("controlled",sum(1 for r in records if r[6] in ("VC_AC","PC_AC")))
print("ps",sum(1 for r in records if r[6]=="PS"))
print("output",OUT)
