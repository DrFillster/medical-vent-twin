#!/usr/bin/env python3
from pathlib import Path
import duckdb

DER=Path("/Users/philipbernard/mimic-data/derived")
SRC=DER/"phenotype_inputs.parquet"
HIST=DER/"preindex_peep_history.parquet"
OUT=DER/"phenotype_fit_plan.parquet"

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute(f"""
COPY (
WITH x AS (
 SELECT s.*,
   EXISTS (
     SELECT 1 FROM read_parquet('{HIST}') h
     WHERE h.stay_id=s.stay_id
       AND h.index_transition_time=s.transition_time
   ) has_preindex_peep_history,
   EXISTS (
     SELECT 1 FROM read_parquet('{HIST}') h
     WHERE h.stay_id=s.stay_id
       AND h.index_transition_time=s.transition_time
       AND h.historical_pre_compliance IS NOT NULL
       AND h.historical_post_compliance IS NOT NULL
   ) has_preindex_compliance_response,
   EXISTS (
     SELECT 1 FROM read_parquet('{HIST}') h
     WHERE h.stay_id=s.stay_id
       AND h.index_transition_time=s.transition_time
       AND h.historical_pre_hr IS NOT NULL
       AND h.historical_post_hr IS NOT NULL
       AND h.historical_pre_map IS NOT NULL
       AND h.historical_post_map IS NOT NULL
   ) has_preindex_hemodynamic_response
 FROM read_parquet('{SRC}') s
)
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

  CASE
    WHEN has_preindex_peep_history THEN 'fit_from_preindex_peep_history'
    ELSE 'prior_constrained'
  END recruitability_status,

  CASE
    WHEN hummod_mode='PS' AND identifiability_grade IN ('A','B')
      THEN 'fit_discrete_profile'
    WHEN hummod_mode='PS' THEN 'not_identifiable'
    ELSE 'not_applicable'
  END effort_status,

  CASE
    WHEN has_preindex_hemodynamic_response
      THEN 'fit_from_preindex_peep_history'
    ELSE 'prior_constrained'
  END hemodynamic_sensitivity_status,

  -- Autonomic gain remains prior-constrained. HR/MAP response to PEEP alone
  -- cannot uniquely separate autonomic gain from preload/afterload effects.
  'prior_constrained' autonomic_gain_status,

  identifiability_grade IN ('A','B') AS eligible_for_primary_prefit,

  CASE
    WHEN hummod_mode='PS' THEN
      'fit effort profile from pre-transition respiratory observables; fit gas/mechanics parameters only where status permits'
    ELSE
      'fit gas/mechanics parameters only where status permits; controlled mode has no effort-profile fit'
  END fit_instruction
FROM x
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("rows",con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
print("primary_prefit",con.execute(f"select count(*) from read_parquet('{OUT}') where eligible_for_primary_prefit").fetchone()[0])
print("with_preindex_peep_history",con.execute(f"select count(*) from read_parquet('{OUT}') where has_preindex_peep_history").fetchone()[0])
print("with_preindex_compliance_response",con.execute(f"select count(*) from read_parquet('{OUT}') where has_preindex_compliance_response").fetchone()[0])
print("with_preindex_hemodynamic_response",con.execute(f"select count(*) from read_parquet('{OUT}') where has_preindex_hemodynamic_response").fetchone()[0])
for col in [
  "compliance_status","resistance_status","shunt_status","dead_space_status",
  "recruitability_status","effort_status","hemodynamic_sensitivity_status","autonomic_gain_status"
]:
    print(col)
    for r in con.execute(f"select {col},count(*) from read_parquet('{OUT}') group by 1 order by 2 desc").fetchall():
        print(" ",*r)
