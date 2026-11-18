#!/usr/bin/env python3
from pathlib import Path
import duckdb

DER=Path("/Users/philipbernard/mimic-data/derived")
PHENO=DER/"phenotype_inputs.parquet"
PAIR=DER/"deadspace_etco2_pairs.parquet"
OUT=DER/"phenotype_inputs_with_etco2.parquet"

con=duckdb.connect()
con.execute(f"""
COPY (
SELECT p.*,
  d.petco2 pre_petco2,
  d.pair_minutes petco2_pair_minutes,
  d.paco2_petco2_fraction measured_paco2_petco2_fraction,
  CASE
    WHEN d.pair_minutes<=5
      AND d.paco2_petco2_fraction BETWEEN 0 AND 0.8
      THEN 'A'
    WHEN d.pair_minutes<=15
      AND d.paco2_petco2_fraction BETWEEN 0 AND 0.8
      THEN 'B'
    WHEN d.pair_minutes<=30
      AND d.paco2_petco2_fraction BETWEEN 0 AND 0.8
      THEN 'C'
    ELSE NULL
  END etco2_deadspace_quality,
  CASE
    WHEN d.pair_minutes<=15
      AND d.paco2_petco2_fraction BETWEEN 0 AND 0.8
      THEN 'measured_paco2_petco2_gradient'
    ELSE 'latent_or_prior_constrained'
  END deadspace_measurement_status
FROM read_parquet('{PHENO}') p
LEFT JOIN read_parquet('{PAIR}') d
  ON d.stay_id=p.stay_id
 AND d.transition_time=p.transition_time
 AND d.transition_itemid=p.transition_itemid
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("rows",con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
for r in con.execute(f"""
select coalesce(etco2_deadspace_quality,'none') quality,count(*) n
from read_parquet('{OUT}')
group by 1 order by 1
""").fetchall(): print(r)
print("strict_measured",con.execute(f"""
select count(*) from read_parquet('{OUT}')
where deadspace_measurement_status='measured_paco2_petco2_gradient'
""").fetchone()[0])
