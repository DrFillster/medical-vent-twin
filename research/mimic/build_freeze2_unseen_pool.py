#!/usr/bin/env python3
from pathlib import Path
import duckdb

DER=Path("/Users/philipbernard/mimic-data/derived")
IDX=DER/"fit_event_index.parquet"
OPENED=DER/"outcome_bridge_frozen136.parquet"
PHENO=DER/"phenotype_inputs.parquet"
OUT=DER/"freeze2_outcome_unseen_pool.parquet"

con=duckdb.connect()
con.execute(f"""
COPY (
 SELECT i.*,p.pre_mode,p.pre_ph,p.pre_pco2,p.pre_po2,p.pre_spo2,p.pre_hr,p.pre_map,
        p.pre_fio2,p.pre_peep,p.pre_rr_set,p.pre_vt_set,p.pre_psv,p.pre_pinsp,
        p.pre_vt_observed,p.pre_minute_volume,p.pre_rr_spontaneous,p.pre_rr_total
 FROM read_parquet('{IDX}') i
 JOIN read_parquet('{PHENO}') p
   ON p.stay_id=i.stay_id AND p.transition_time=i.transition_time
 WHERE NOT EXISTS (
   SELECT 1 FROM read_parquet('{OPENED}') o WHERE o.event_id=i.event_id
 )
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")
print("rows",con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
for r in con.execute(f"select hummod_mode,count(*) from read_parquet('{OUT}') group by 1 order by 1").fetchall():
    print(*r)
print("p_cmv",con.execute(f"select count(*) from read_parquet('{OUT}') where pre_mode='P-CMV'").fetchone()[0])
