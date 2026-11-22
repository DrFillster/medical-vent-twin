#!/usr/bin/env python3
"""Pre-change chart/lab availability screen; not invasive-airway adjudication."""
from pathlib import Path
import json,sys,hashlib
import duckdb
b=Path(sys.argv[1]);o=b/'prechange-candidate-screen-v2';o.mkdir(exist_ok=False);c=duckdb.connect();c.execute("SET threads=4");c.execute("SET memory_limit='2GB'");c.execute("SET temp_directory='/Users/philipbernard/mimic-data/tmp'")
c.execute('CREATE TABLE e AS SELECT row_number() OVER (ORDER BY subject_id,stay_id,itemid,charttime) event_key,* FROM read_parquet(?)',[str(b/'outcome-independent-transitions-v1/candidates.parquet')])
# Both clinical and recording times must precede intervention; null/invalid latest
# blocks are retained so they cannot be skipped to an older convenient value.
c.execute("""CREATE TABLE latest AS WITH blocks AS (
SELECT e.event_key,v.itemid,v.charttime,count(*) n,count(v.value) ntext,count(v.valuenum) nnum,
count(distinct v.value) nvalues,count(distinct v.valuenum) nnumbers,
min(v.value) text_value,min(v.valuenum) number_value,min(v.valueuom) unit,
count(distinct v.valueuom) nunits,
row_number() OVER(PARTITION BY e.event_key,v.itemid ORDER BY v.charttime DESC) rank
FROM e JOIN read_parquet(?) v ON v.subject_id=e.subject_id AND v.stay_id=e.stay_id
AND v.charttime>=e.charttime-INTERVAL '2 hours' AND v.charttime<e.charttime
AND v.storetime<e.charttime
WHERE v.itemid IN(223849,229314,223835,220339,224701,224685,224687,224690)
GROUP BY e.event_key,v.itemid,v.charttime)
SELECT * FROM blocks WHERE rank=1""",[str(b/'vent_chart_events.parquet')])
c.execute("""CREATE TABLE flags AS SELECT e.event_key,
count(*) FILTER(WHERE l.itemid=223849 AND nvalues=1 AND ntext=n AND text_value IN('PSV','CPAP/PSV','Pressure Support','PS'))=1
AND count(*) FILTER(WHERE l.itemid=229314 AND (nvalues<>1 OR ntext<>n OR text_value NOT IN('PSV','CPAP/PSV','Pressure Support','PS')))=0 mode_pass,
count(*) FILTER(WHERE l.itemid=223835 AND nnumbers=1 AND nnum=n AND (number_value BETWEEN .21 AND 1 OR number_value BETWEEN 21 AND 100))=1 fio2_pass,
count(*) FILTER(WHERE l.itemid=220339 AND nnumbers=1 AND nnum=n AND number_value BETWEEN 0 AND 30 AND nunits=1 AND unit='cmH2O')=1 peep_pass,
count(*) FILTER(WHERE l.itemid=224701 AND nnumbers=1 AND nnum=n AND number_value>=0 AND nunits=1 AND unit='cmH2O')=1 ps_pass,
count(*) FILTER(WHERE l.itemid=224685 AND nnumbers=1 AND nnum=n AND number_value>0 AND nunits=1 AND unit='mL')=1 vt_pass,
count(*) FILTER(WHERE l.itemid=224687 AND nnumbers=1 AND nnum=n AND number_value>0 AND nunits=1 AND unit='L/min')=1 mv_pass,
count(*) FILTER(WHERE l.itemid=224690 AND nnumbers=1 AND nnum=n AND number_value>0 AND nunits=1 AND unit='insp/min')=1 rr_pass
FROM e LEFT JOIN latest l USING(event_key) GROUP BY e.event_key""")
c.execute('CREATE TABLE chart_eligible AS SELECT e.* FROM e JOIN flags USING(event_key) WHERE mode_pass AND fio2_pass AND peep_pass AND ps_pass AND vt_pass AND mv_pass AND rr_pass')
# No post-change lab rows enter this table. Arterial specimen label and all
# components must be available before cutoff and from one specimen/time block.
c.execute("""CREATE TABLE lab_blocks AS SELECT e.event_key,v.specimen_id,v.charttime,
count(*) FILTER(WHERE v.itemid=52033 AND upper(trim(v.value))='ART.')>=1 arterial,
count(*) FILTER(WHERE v.itemid=52033 AND (v.value IS NULL OR upper(trim(v.value))<>'ART.'))=0 no_conflicting_type,
count(distinct v.valuenum) FILTER(WHERE v.itemid=50820)=1 AND count(*) FILTER(WHERE v.itemid=50820 AND (v.valuenum IS NULL OR v.valuenum<=0))=0 ph,
count(distinct v.valuenum) FILTER(WHERE v.itemid=50818)=1 AND count(*) FILTER(WHERE v.itemid=50818 AND (v.valuenum IS NULL OR v.valuenum<=0 OR (v.valueuom IS NULL OR replace(lower(v.valueuom),' ','')<>'mmhg')))=0 co2,
count(distinct v.valuenum) FILTER(WHERE v.itemid=50821)=1 AND count(*) FILTER(WHERE v.itemid=50821 AND (v.valuenum IS NULL OR v.valuenum<=0 OR (v.valueuom IS NULL OR replace(lower(v.valueuom),' ','')<>'mmhg')))=0 o2
FROM chart_eligible e JOIN read_parquet(?) v ON v.subject_id=e.subject_id AND v.hadm_id=e.hadm_id
AND v.charttime>=e.charttime-INTERVAL '4 hours' AND v.charttime<e.charttime AND v.storetime<e.charttime
WHERE v.itemid IN(52033,50820,50818,50821) AND v.specimen_id IS NOT NULL
GROUP BY e.event_key,v.specimen_id,v.charttime""",[str(b/'blood_gas_events.parquet')])
c.execute('CREATE TABLE input_candidates AS SELECT DISTINCT e.* FROM chart_eligible e JOIN lab_blocks l USING(event_key) WHERE arterial AND no_conflicting_type AND ph AND co2 AND o2')
for table in ['flags','latest','lab_blocks','input_candidates']:c.execute('COPY '+table+' TO ? (FORMAT PARQUET,COMPRESSION ZSTD)',[str(o/(table+'.parquet'))])
report={'outcomeValuesRead':False,'postChangeAvailabilityRequired':False,'invasiveAirwayConfirmed':False,'sourceBlockCompatibilityConfirmed':False,'completeHistoricalUseConfirmed':False,'readyForFitting':False,'rules':'existing two-hour chart/four-hour gas windows; strict charttime/storetime before change; latest block only; same-specimen/time arterial label and gases','sourceBlockLimitation':'latest values can be different times; mode is not proof of invasive airway; no stability inferred'}
for table in ['e','chart_eligible','input_candidates']:report[table]=dict(zip(['events','subjects'],c.execute('SELECT count(*),count(distinct subject_id) FROM '+table).fetchone()))
report['sequentialExclusions']=[];predicate='true'
for flag in ['mode_pass','fio2_pass','peep_pass','ps_pass','vt_pass','mv_pass','rr_pass']:
 n=c.execute('SELECT count(*) FROM flags WHERE '+predicate+' AND NOT '+flag).fetchone()[0];report['sequentialExclusions'].append({'failed':flag,'events':n});predicate+=' AND '+flag
report['noAvailableCompleteArterialGasEvents']=report['chart_eligible']['events']-report['input_candidates']['events']
report['sourceHashes']={n:hashlib.file_digest((b/n).open('rb'),'sha256').hexdigest()for n in ['outcome-independent-transitions-v1/candidates.parquet','vent_chart_events.parquet','blood_gas_events.parquet']}
(o/'summary.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
