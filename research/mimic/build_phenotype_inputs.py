#!/usr/bin/env python3
from pathlib import Path
import duckdb

DER=Path("/Users/philipbernard/mimic-data/derived")
POOL=DER/"pilot_supported_mode_pool.parquet"
VENT=DER/"vent_chart_events.parquet"
ABG=DER/"arterial_blood_gases.parquet"
OUT=DER/"phenotype_inputs.parquet"

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("PRAGMA memory_limit='4GB'")

def latest(itemids, col="valuenum", window="2 hours"):
    ids="("+",".join(str(x) for x in itemids)+")"
    return f"""(
      SELECT {col} FROM read_parquet('{VENT}') v
      WHERE v.stay_id=p.stay_id AND v.itemid IN {ids}
        AND v.charttime BETWEEN p.transition_time-INTERVAL '{window}' AND p.transition_time
        AND {col} IS NOT NULL
      ORDER BY v.charttime DESC,v.storetime DESC LIMIT 1
    )"""

con.execute(f"""
COPY (
WITH x AS (
 SELECT
   p.subject_id,p.hadm_id,p.stay_id,p.transition_time,p.itemid transition_itemid,
   p.hummod_mode,p.pre_mode,
   p.prev_x transition_pre_value,p.new_x transition_post_value,
   p.pre_fio2,p.pre_peep,p.pre_rr_set,p.pre_vt_set,p.pre_psv,p.pre_pinsp,

   {latest([220045])} pre_hr,
   {latest([220052])} pre_map,
   {latest([220277])} pre_spo2,

   {latest([224685])} pre_vt_observed,
   {latest([224687])} pre_minute_volume,
   {latest([224689])} pre_rr_spontaneous,
   {latest([224690])} pre_rr_total,
   {latest([224695])} pre_peak_pressure,
   {latest([224696])} pre_plateau_pressure,
   {latest([224697])} pre_mean_airway_pressure,
   {latest([224700])} pre_total_peep,
   {latest([220283,229664,229665])} pre_resistance,
   {latest([229661])} pre_compliance_documented,

   (
     SELECT a.ph FROM read_parquet('{ABG}') a
     WHERE a.hadm_id=p.hadm_id
       AND a.charttime BETWEEN p.transition_time-INTERVAL '4 hours' AND p.transition_time
       AND a.ph IS NOT NULL AND a.pco2 IS NOT NULL AND a.po2 IS NOT NULL
     ORDER BY a.charttime DESC LIMIT 1
   ) pre_ph,
   (
     SELECT a.pco2 FROM read_parquet('{ABG}') a
     WHERE a.hadm_id=p.hadm_id
       AND a.charttime BETWEEN p.transition_time-INTERVAL '4 hours' AND p.transition_time
       AND a.ph IS NOT NULL AND a.pco2 IS NOT NULL AND a.po2 IS NOT NULL
     ORDER BY a.charttime DESC LIMIT 1
   ) pre_pco2,
   (
     SELECT a.po2 FROM read_parquet('{ABG}') a
     WHERE a.hadm_id=p.hadm_id
       AND a.charttime BETWEEN p.transition_time-INTERVAL '4 hours' AND p.transition_time
       AND a.ph IS NOT NULL AND a.pco2 IS NOT NULL AND a.po2 IS NOT NULL
     ORDER BY a.charttime DESC LIMIT 1
   ) pre_po2,
   (
     SELECT a.bicarbonate FROM read_parquet('{ABG}') a
     WHERE a.hadm_id=p.hadm_id
       AND a.charttime BETWEEN p.transition_time-INTERVAL '4 hours' AND p.transition_time
       AND a.ph IS NOT NULL AND a.pco2 IS NOT NULL AND a.po2 IS NOT NULL
     ORDER BY a.charttime DESC LIMIT 1
   ) pre_bicarbonate,
   (
     SELECT a.base_excess FROM read_parquet('{ABG}') a
     WHERE a.hadm_id=p.hadm_id
       AND a.charttime BETWEEN p.transition_time-INTERVAL '4 hours' AND p.transition_time
       AND a.ph IS NOT NULL AND a.pco2 IS NOT NULL AND a.po2 IS NOT NULL
     ORDER BY a.charttime DESC LIMIT 1
   ) pre_base_excess,
   (
     SELECT a.lactate FROM read_parquet('{ABG}') a
     WHERE a.hadm_id=p.hadm_id
       AND a.charttime BETWEEN p.transition_time-INTERVAL '4 hours' AND p.transition_time
       AND a.ph IS NOT NULL AND a.pco2 IS NOT NULL AND a.po2 IS NOT NULL
     ORDER BY a.charttime DESC LIMIT 1
   ) pre_lactate
 FROM read_parquet('{POOL}') p
),
derived AS (
 SELECT *,
   CASE WHEN pre_fio2 BETWEEN 21 AND 100 AND pre_po2 IS NOT NULL
     THEN pre_po2/(pre_fio2/100.0) END pre_pf_ratio,
   CASE WHEN pre_plateau_pressure IS NOT NULL
             AND coalesce(pre_total_peep,pre_peep) IS NOT NULL
             AND pre_vt_observed IS NOT NULL
             AND pre_plateau_pressure > coalesce(pre_total_peep,pre_peep)
     THEN pre_vt_observed/(pre_plateau_pressure-coalesce(pre_total_peep,pre_peep))
   END pre_compliance_derived,
   CASE WHEN pre_minute_volume IS NOT NULL AND pre_pco2 IS NOT NULL
     THEN pre_minute_volume*pre_pco2 END ventilation_co2_index,
   ((pre_rr_spontaneous IS NOT NULL)::INT+
    (pre_rr_total IS NOT NULL)::INT+
    (pre_vt_observed IS NOT NULL)::INT+
    (pre_minute_volume IS NOT NULL)::INT) effort_observable_count,
   ((pre_peak_pressure IS NOT NULL)::INT+
    (pre_plateau_pressure IS NOT NULL)::INT+
    (pre_resistance IS NOT NULL)::INT+
    (pre_compliance_documented IS NOT NULL)::INT) mechanics_observable_count
 FROM x
),
graded AS (
 SELECT *,
   CASE
     WHEN pre_ph IS NOT NULL AND pre_pco2 IS NOT NULL AND pre_po2 IS NOT NULL
      AND pre_hr IS NOT NULL AND pre_map IS NOT NULL AND pre_spo2 IS NOT NULL
      AND pre_fio2 IS NOT NULL AND pre_peep IS NOT NULL
      AND (
        (hummod_mode='PS' AND effort_observable_count>=3)
        OR
        (hummod_mode IN ('VC_AC','PC_AC') AND mechanics_observable_count>=1)
      )
     THEN 'A'
     WHEN pre_ph IS NOT NULL AND pre_pco2 IS NOT NULL AND pre_po2 IS NOT NULL
      AND pre_hr IS NOT NULL AND pre_map IS NOT NULL AND pre_spo2 IS NOT NULL
      AND pre_fio2 IS NOT NULL AND pre_peep IS NOT NULL
      AND (
        (hummod_mode='PS' AND effort_observable_count>=2)
        OR
        (hummod_mode IN ('VC_AC','PC_AC'))
      )
     THEN 'B'
     ELSE 'C'
   END identifiability_grade,

   -- Latent mechanistic parameters are intentionally NULL until fitted
   NULL::DOUBLE fitted_compliance_ml_per_cmh2o,
   NULL::DOUBLE fitted_resistance_cmh2o_s_per_l,
   NULL::DOUBLE fitted_shunt_fraction,
   NULL::DOUBLE fitted_dead_space_fraction,
   NULL::DOUBLE fitted_recruitability,
   NULL::VARCHAR fitted_effort_profile,
   NULL::DOUBLE fitted_hemodynamic_sensitivity,
   NULL::DOUBLE fitted_autonomic_gain
 FROM derived
)
SELECT * FROM graded
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("phenotype_rows",con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
for r in con.execute(f"select identifiability_grade,count(*) from read_parquet('{OUT}') group by 1 order by 1").fetchall():
    print("grade",*r)
for r in con.execute(f"select hummod_mode,identifiability_grade,count(*) from read_parquet('{OUT}') group by 1,2 order by 1,2").fetchall():
    print("mode_grade",*r)
print("pf_available",con.execute(f"select count(*) from read_parquet('{OUT}') where pre_pf_ratio is not null").fetchone()[0])
print("derived_compliance_available",con.execute(f"select count(*) from read_parquet('{OUT}') where pre_compliance_derived is not null").fetchone()[0])
