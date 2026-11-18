#!/usr/bin/env python3
from pathlib import Path
import duckdb

DER=Path("/Users/philipbernard/mimic-data/derived")
VENT=DER/"vent_chart_events.parquet"
O2=DER/"oxygen_delivery_device_events.parquet"
OUT=DER/"mimic_ventilation_status.parquet"

con=duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute("PRAGMA memory_limit='4GB'")
con.execute("PRAGMA temp_directory='/Users/philipbernard/mimic-data/tmp'")

invasive_mode = (
'(S) CMV','APRV','APRV/Biphasic+ApnPress','APRV/Biphasic+ApnVol','APV (cmv)',
'Ambient','Apnea Ventilation','CMV','CMV/ASSIST','CMV/ASSIST/AutoFlow',
'CMV/AutoFlow','CPAP/PPS','CPAP/PSV','CPAP/PSV+Apn TCPL','CPAP/PSV+ApnPres',
'CPAP/PSV+ApnVol','MMV','MMV/AutoFlow','MMV/PSV','MMV/PSV/AutoFlow','P-CMV',
'PCV+','PCV+/PSV','PCV+Assist','PRES/AC','PRVC/AC','PRVC/SIMV','PSV/SBT',
'SIMV','SIMV/AutoFlow','SIMV/PRES','SIMV/PSV','SIMV/PSV/AutoFlow','SIMV/VOL',
'SYNCHRON MASTER','SYNCHRON SLAVE','VOL/AC'
)
invasive_hamilton=('APRV','APV (cmv)','Ambient','(S) CMV','P-CMV','SIMV','APV (simv)','P-SIMV','VS','ASV')
niv_hamilton=('DuoPaP','NIV','NIV-ST')

con.execute(f"""
COPY (
WITH mode_rows AS (
 SELECT stay_id,charttime,
   max(CASE WHEN itemid=223849 THEN value END) ventilator_mode,
   max(CASE WHEN itemid=229314 THEN value END) ventilator_mode_hamilton
 FROM read_parquet('{VENT}')
 WHERE itemid IN (223849,229314) AND value IS NOT NULL
 GROUP BY stay_id,charttime
),
o2_rank AS (
 SELECT stay_id,charttime,value o2_device,
   row_number() over(
     PARTITION BY stay_id,charttime
     ORDER BY storetime DESC NULLS LAST,value DESC NULLS LAST
   ) rn
 FROM read_parquet('{O2}')
),
o2 AS (
 SELECT stay_id,charttime,
   max(CASE WHEN rn=1 THEN o2_device END) o2_delivery_device_1,
   max(CASE WHEN rn=2 THEN o2_device END) o2_delivery_device_2,
   max(CASE WHEN rn=3 THEN o2_device END) o2_delivery_device_3,
   max(CASE WHEN rn=4 THEN o2_device END) o2_delivery_device_4
 FROM o2_rank
 WHERE rn<=4
 GROUP BY stay_id,charttime
),
tm AS (
 SELECT stay_id,charttime FROM mode_rows
 UNION
 SELECT stay_id,charttime FROM o2
),
vs AS (
 SELECT tm.stay_id,tm.charttime,
   o2_delivery_device_1,o2_delivery_device_2,o2_delivery_device_3,o2_delivery_device_4,
   m.ventilator_mode,m.ventilator_mode_hamilton,
   CASE
     WHEN o2_delivery_device_1 IN ('Tracheostomy tube','Trach mask ') THEN 'Tracheostomy'
     WHEN o2_delivery_device_1='Endotracheal tube'
       OR m.ventilator_mode IN {invasive_mode}
       OR m.ventilator_mode_hamilton IN {invasive_hamilton}
       THEN 'InvasiveVent'
     WHEN o2_delivery_device_1 IN ('Bipap mask ','CPAP mask ')
       OR o2_delivery_device_2 IN ('Bipap mask ','CPAP mask ')
       OR o2_delivery_device_3 IN ('Bipap mask ','CPAP mask ')
       OR o2_delivery_device_4 IN ('Bipap mask ','CPAP mask ')
       OR m.ventilator_mode_hamilton IN {niv_hamilton}
       THEN 'NonInvasiveVent'
     WHEN o2_delivery_device_1='High flow nasal cannula' THEN 'HFNC'
     WHEN o2_delivery_device_1 IN (
       'Non-rebreather','Face tent','Aerosol-cool','Venti mask ','Medium conc mask ',
       'Ultrasonic neb','Vapomist','Oxymizer','High flow neb','Nasal cannula'
     ) THEN 'SupplementalOxygen'
     WHEN o2_delivery_device_1='None' THEN 'None'
     ELSE NULL
   END ventilation_status
 FROM tm
 LEFT JOIN mode_rows m USING(stay_id,charttime)
 LEFT JOIN o2 USING(stay_id,charttime)
),
vd0 AS (
 SELECT stay_id,charttime,ventilation_status,
   lag(charttime) over(partition by stay_id,ventilation_status order by charttime) charttime_lag,
   lead(charttime) over(partition by stay_id order by charttime) charttime_lead,
   lag(ventilation_status) over(partition by stay_id order by charttime) ventilation_status_lag
 FROM vs
 WHERE ventilation_status IS NOT NULL
),
vd1 AS (
 SELECT *,
   CASE
     WHEN ventilation_status_lag IS NULL THEN 1
     WHEN date_diff('hour',charttime_lag,charttime)>=14 THEN 1
     WHEN ventilation_status_lag<>ventilation_status THEN 1
     ELSE 0
   END new_ventilation_event
 FROM vd0
),
vd2 AS (
 SELECT *,
   sum(new_ventilation_event) over(partition by stay_id order by charttime) vent_seq
 FROM vd1
)
SELECT stay_id,
 min(charttime) starttime,
 max(CASE
   WHEN charttime_lead IS NULL OR date_diff('hour',charttime,charttime_lead)>=14
     THEN charttime
   ELSE charttime_lead
 END) endtime,
 max(ventilation_status) ventilation_status
FROM vd2
GROUP BY stay_id,vent_seq
HAVING min(charttime)<>max(charttime)
) TO '{OUT}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

print("episodes",con.execute(f"select count(*) from read_parquet('{OUT}')").fetchone()[0])
for r in con.execute(f"select ventilation_status,count(*) n from read_parquet('{OUT}') group by ventilation_status order by n desc").fetchall():
    print(r)
