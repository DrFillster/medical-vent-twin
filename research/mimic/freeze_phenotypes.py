#!/usr/bin/env python3
from pathlib import Path
import json, subprocess
import duckdb

ROOT=Path("/Users/philipbernard/medical-vent-twin")
DER=Path("/Users/philipbernard/mimic-data/derived")
CONTROL=DER/"controlled_fit_results.jsonl"
PS_PARTS=sorted(DER.glob("ps_fit_full_part*.jsonl"))
INDEX=DER/"fit_event_index.parquet"
OUT=DER/"frozen_phenotypes.parquet"

def load_jsonl(path):
    if not path.exists(): return []
    return [json.loads(x) for x in path.read_text().splitlines() if x.strip()]

controlled=load_jsonl(CONTROL)
ps=[]
for p in PS_PARTS:
    ps.extend(load_jsonl(p))

commit=subprocess.check_output(
    ["git","rev-parse","HEAD"],cwd=ROOT,text=True
).strip()

rows=[]
for r in controlled:
    status=r.get("status")
    gas=r.get("scores",{}).get("gas")
    mech=r.get("scores",{}).get("mechanics")
    if status!="fit-complete":
        rep="runtime-unrepresentable"
    elif gas is not None and mech is not None and gas<=2 and mech<=3:
        rep="well-represented"
    elif gas is not None and mech is not None and (gas>10 or mech>10):
        rep="clear-baseline-mismatch"
    else:
        rep="intermediate"
    f=r.get("fitted",{})
    rows.append((
        r["event_id"],"controlled",status,rep,
        gas,mech,None,
        None,None,
        f.get("stiffness_scale"),
        f.get("central_airway_resistance"),
        f.get("fixed_nonventilated_perfusion_fraction"),
        f.get("dead_space_fraction_of_vt"),
        f.get("dead_space_ml"),
        f.get("baseline_recruitment_prior"),
        "0.2.0",commit
    ))

for r in ps:
    status=r.get("status")
    effort=r.get("scores",{}).get("effort")
    gas=r.get("scores",{}).get("gas")
    if status!="fit-complete":
        rep="runtime-unrepresentable"
    elif effort is not None and gas is not None and effort<=2 and gas<=2:
        rep="well-represented"
    elif effort is not None and gas is not None and (effort>10 or gas>10):
        rep="clear-baseline-mismatch"
    else:
        rep="intermediate"
    f=r.get("fitted",{})
    rows.append((
        r["event_id"],"PS",status,rep,
        gas,None,effort,
        f.get("effort_profile"),
        f.get("hennigs_drive_relative"),
        f.get("stiffness_scale"),
        f.get("central_airway_resistance"),
        f.get("fixed_nonventilated_perfusion_fraction"),
        f.get("dead_space_fraction_of_vt"),
        f.get("dead_space_ml"),
        None,
        "0.2.0",commit
    ))

con=duckdb.connect()
con.execute("""
CREATE OR REPLACE TABLE frozen(
 event_id VARCHAR,
 fit_domain VARCHAR,
 fit_status VARCHAR,
 representability VARCHAR,
 gas_score DOUBLE,
 mechanics_score DOUBLE,
 effort_score DOUBLE,
 effort_profile VARCHAR,
 hennigs_drive_relative DOUBLE,
 stiffness_scale DOUBLE,
 central_airway_resistance DOUBLE,
 fixed_nonventilated_perfusion_fraction DOUBLE,
 dead_space_fraction_of_vt DOUBLE,
 dead_space_ml DOUBLE,
 baseline_recruitment_prior DOUBLE,
 phenotype_schema_version VARCHAR,
 code_commit VARCHAR
)
""")
con.executemany("INSERT INTO frozen VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",rows)

# Fail closed if any phenotype event cannot be mapped back to the local index.
missing=con.execute(f"""
SELECT count(*)
FROM frozen f
LEFT JOIN read_parquet('{INDEX}') i USING(event_id)
WHERE i.event_id IS NULL
""").fetchone()[0]
if missing:
    raise RuntimeError(f"{missing} phenotype events are missing from local event index")

con.execute(f"COPY frozen TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)")

print("frozen_rows",len(rows))
print("controlled",len(controlled))
print("ps",len(ps))
print("schema","0.2.0")
print("commit",commit)
for r in con.execute("""
SELECT fit_domain,representability,count(*) n
FROM frozen
GROUP BY fit_domain,representability
ORDER BY fit_domain,representability
""").fetchall():
    print(*r)
print("output",OUT)
