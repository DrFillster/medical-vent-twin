#!/usr/bin/env python3
import tempfile,json,csv,gzip,contextlib,io
from pathlib import Path
import duckdb
from extract_development_disease_context import extract
with tempfile.TemporaryDirectory()as temp:
 root=Path(temp);b=root/'derived';raw=root/'raw';(b/'dev-qualified-prediction-v1').mkdir(parents=True);(b/'dev-disease-evidence-v1').mkdir();(raw/'hosp').mkdir(parents=True)
 ids=[str(i)for i in range(19)];(b/'dev-qualified-prediction-v1/manifest.json').write_text(json.dumps({'qualifiedIds':ids[:10],'excludedIds':ids[10:]}))
 for name,head,rows in [('diagnoses_icd.csv.gz',['subject_id','hadm_id','seq_num','icd_code','icd_version'],[[i,i,1,'TEST','10']for i in range(19)]),('d_icd_diagnoses.csv.gz',['icd_code','icd_version','long_title'],[['TEST','10','Synthetic diagnosis not available at cutoff']])]:
  with gzip.open(raw/'hosp'/name,'wt')as f:w=csv.writer(f);w.writerow(head);w.writerows(rows)
 c=duckdb.connect();c.execute('create table e(event_id varchar,subject_id bigint,hadm_id bigint,transition_time timestamp)');c.execute('create table a(hadm_id bigint,specimen_id bigint,charttime timestamp,ph double,pco2 double,po2 double)');c.execute('create table l(hadm_id bigint,specimen_id bigint,itemid bigint,charttime timestamp,storetime timestamp,valuenum double,valueuom varchar)')
 for i in range(19):
  c.execute("insert into e values (?,?,?,'2020-01-01 12:00:00')",[str(i),i,i]);c.execute("insert into a values (?,?,'2020-01-01 11:00:00',7.4,40,80)",[i,i])
  for item,val in [(50820,7.4),(50818,40),(50821,80)]:
   store='2020-01-01 12:01:00'if i==0 else '2020-01-01 11:30:00';c.execute("insert into l values (?,?,?,'2020-01-01 11:00:00',?,?,?)",[i,i,item,store,val,'synthetic'])
  # A future specimen must never replace the pre-cutoff one.
  c.execute("insert into a values (?,?,'2020-01-01 13:00:00',7.3,50,60)",[i,i+100])
 for table,name in [('e','primary60_fit_manifest.parquet'),('a','arterial_blood_gases.parquet'),('l','blood_gas_events.parquet')]:c.execute('copy '+table+' to ? (format parquet)',[str(b/name)])
 with contextlib.redirect_stdout(io.StringIO()):extract(b,raw)
 report=json.loads((b/'dev-disease-evidence-v1/disease_context_audit.json').read_text());assert report['events_latest_complete_abg_strictly_available']==18;assert report['lab_component_rows']==57
 dx=json.loads((b/'dev-disease-evidence-v1/retrospective_diagnosis_context.json').read_text());assert len(dx)==19 and all(not x['available_before_cutoff']for x in dx)
 assert not report['diagnosesUsedAsPredictionInputs']and not report['caseAssignmentsMade']
print('PASS: discharge-code firewall, pre-cutoff specimen selection, future specimen exclusion, delayed result availability')
