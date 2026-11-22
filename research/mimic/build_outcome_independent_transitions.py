#!/usr/bin/env python3
"""Enumerate setting changes without blood-gas or downstream outcome selection."""
from pathlib import Path
import json,sys,hashlib
import duckdb

def build(con):
 con.execute("""CREATE TABLE blocks AS
 SELECT subject_id,hadm_id,stay_id,itemid,charttime,
 min(storetime) first_storetime,max(storetime) last_storetime,
 count(*) source_rows,
 count(distinct CASE WHEN itemid=223835 AND valuenum BETWEEN .21 AND 1 THEN valuenum*100 ELSE valuenum END) distinct_values,
 bool_and(CASE WHEN itemid=223835 THEN (valuenum BETWEEN .21 AND 1 OR valuenum BETWEEN 21 AND 100) AND valueuom IS NULL WHEN itemid=220339 THEN valuenum BETWEEN 0 AND 30 AND valueuom='cmH2O' ELSE false END) all_values_valid,
 count(valuenum)=count(*) numbers_complete,
 count(storetime)=count(*) storetimes_complete,
 min(CASE WHEN itemid=223835 AND valuenum BETWEEN .21 AND 1 THEN valuenum*100 ELSE valuenum END) setting
 FROM settings WHERE itemid IN (223835,220339) AND charttime IS NOT NULL AND stay_id IS NOT NULL
 GROUP BY subject_id,hadm_id,stay_id,itemid,charttime""")
 con.execute("""CREATE TABLE transitions AS WITH lagged AS (
 SELECT *,lag(setting) OVER w prev_setting,lag(charttime) OVER w prev_charttime,
 lag(last_storetime) OVER w prev_storetime,
 lag(distinct_values=1 AND all_values_valid AND numbers_complete AND storetimes_complete) OVER w prev_valid
 FROM blocks WINDOW w AS (PARTITION BY subject_id,stay_id,itemid ORDER BY charttime))
 SELECT *,prev_storetime<charttime prior_available_before_change,
 greatest(charttime,last_storetime) recognition_time
 FROM lagged WHERE distinct_values=1 AND all_values_valid AND numbers_complete AND storetimes_complete
 AND prev_valid AND prev_charttime<charttime
 AND abs(setting-prev_setting)>=CASE itemid WHEN 223835 THEN 10 ELSE 2 END""")

def main(b):
 o=b/'outcome-independent-transitions-v1';o.mkdir(exist_ok=False);c=duckdb.connect();c.execute("SET threads=4");c.execute("SET memory_limit='2GB'")
 c.execute('CREATE TABLE settings AS SELECT subject_id,hadm_id,stay_id,itemid,charttime,storetime,valuenum,valueuom FROM read_parquet(?)',[str(b/'vent_chart_events.parquet')]);build(c)
 c.execute('CREATE TABLE used AS SELECT DISTINCT subject_id FROM (SELECT subject_id FROM read_parquet(?) UNION ALL SELECT subject_id FROM read_parquet(?))',[str(b/'fit_event_index.parquet'),str(b/'primary60_fit_manifest.parquet')])
 c.execute('CREATE TABLE adults AS SELECT DISTINCT subject_id,stay_id,intime,outtime FROM read_parquet(?)',[str(b/'adult_icustays.parquet')])
 c.execute('CREATE TABLE candidates AS SELECT t.* FROM transitions t JOIN adults a USING(subject_id,stay_id) ANTI JOIN used u USING(subject_id) WHERE t.charttime>=a.intime AND t.charttime<a.outtime AND prior_available_before_change')
 for table in ['transitions','candidates']:c.execute('COPY '+table+' TO ? (FORMAT PARQUET,COMPRESSION ZSTD)',[str(o/(table+'.parquet'))])
 report={'source':'vent_chart_events.parquet: item-only raw chartevents extraction verified in extract_core.py','selection':'material FiO2/PEEP changes only; no outcome or gas table joined','timestampPolicy':'conflicting/invalid same-time blocks block adjacent comparison; prior stored before current chart time; recognition time retained','thresholdMeaning':'existing engineering extraction thresholds, not clinical care thresholds','newTestCohortEstablished':False,'completePriorUseEstablished':False,'modeEligibilityEstablished':False,'clinicalSteadyExposureEstablished':False,'adultDefinition':'existing adult_icustays anchor-age extraction; inherited eligibility limitation','outcomeValuesRead':False}
 for table in ['settings','blocks','transitions','candidates']:
  report[table]=dict(zip(['rows','subjects'],c.execute('SELECT count(*),count(distinct subject_id) FROM '+table).fetchone()))
 report['candidateByItem']=[dict(zip(['itemid','events','subjects'],x))for x in c.execute('SELECT itemid,count(*),count(distinct subject_id) FROM candidates GROUP BY itemid ORDER BY itemid').fetchall()]
 report['excludedHistoricalSubjects']=c.execute('SELECT count(*) FROM used').fetchone()[0]
 report['sourceHashes']={n:hashlib.file_digest((b/n).open('rb'),'sha256').hexdigest()for n in ['vent_chart_events.parquet','adult_icustays.parquet','fit_event_index.parquet','primary60_fit_manifest.parquet']}
 (o/'summary.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
if __name__=='__main__':main(Path(sys.argv[1]))
