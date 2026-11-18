#!/usr/bin/env python3
from pathlib import Path
import duckdb

DER=Path("/Users/philipbernard/mimic-data/derived")
SRC=DER/"phenotype_inputs.parquet"
OUT=DER/"phenotype_fit_plan.parquet"

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute(f"""
COPY (
SELECT *,
  CASE
    WHEN pre_compliance_derived IS NOT NULL THEN 'measured_derived'
    WHEN pre_compliance_documented IS NOT NULL THEN 'measured_documented'
    WHEN identifiability_grade IN ('A','B') THEN 'fit'
    ELSE 'not_identifiable'
  END compliance_status,

  CASE
    WHEN pre_resistance IS NOT NULL THEN 'measured_documented'
    WHEN pre_peak_pressure IS NOT NULL AND pre_plateau_pressure IS NOT NULL
         AND pre_minute_volume IS NOT NULL
         AND identifiability_grade IN ('A','B') THEN 'fit'
    ELSE 'prior_constrained'
  END resistance_status,

  CASE
    WHEN pre_po2 IS NOT NULL AND pre_fio2 IS NOT NULL
         AND pre_spo2 IS NOT NULL AND identifiability_grade IN ('A','B')
      THEN 'fit'
    ELSE 'not_identifiable'
  END shunt_status,

  CASE
    WHEN pre_pco2 IS NOT NULL AND pre_minute_volume IS NOT NULL
         AND identifiability_grade IN ('A','B')
      THEN 'fit'
    ELSE 'prior_constrained'
  END dead_space_status,

  -- Recruitability requires pre-index PEEP-response history or another
  -- independent recruitment-sensitive observation. A single baseline state
  -- does not identify it.
  'prior_constrained' recruitability_status,

  CASE
    WHEN hummod_mode='PS' AND identifiability_grade IN ('A','B')
      THEN 'fit_discrete_profile'
    WHEN hummod_mode='PS' THEN 'not_identifiable'
    ELSE 'not_applicable'
  END effort_status,

  -- A single HR/MAP operating point cannot identify pressure sensitivity
  -- or autonomic gain. These require pre-index perturbation history.
  'prior_constrained' hemodynamic_sensitivity_status,
  'prior_constrained' autonomic_gain_status,

  CASE
    WHEN identifiability_grade='A' THEN true
    WHEN identifiability_grade='B' THEN true
    ELSE false
  END eligible_for_primary_prefit,

  CASE
    WHEN hummod_mode='PS' THEN
      'fit effort profile from pre-transition respiratory observables; fit gas/mechanics parameters only where status permits'
    ELSE
      'fit gas/mechanics parameters only where status permits; controlled mode has no effort-profile fit'
  END fit_instruction
FROM read_parquet('{SRC}')
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("rows",con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
print("primary_prefit",con.execute(f"select count(*) from read_parquet('{OUT}') where eligible_for_primary_prefit").fetchone()[0])
for col in [
  "compliance_status","resistance_status","shunt_status","dead_space_status",
  "recruitability_status","effort_status","hemodynamic_sensitivity_status","autonomic_gain_status"
]:
    print(col)
    for r in con.execute(f"select {col},count(*) from read_parquet('{OUT}') group by 1 order by 2 desc").fetchall():
        print(" ",*r)
