#!/usr/bin/env python3
"""Separate retrospective codes from strict pre-cutoff lab/source evidence."""
from pathlib import Path
import json,sys,csv,gzip
import duckdb

def extract(base,raw):
 b=Path(base);raw=Path(raw);out=b/'dev-disease-evidence-v1';c=duckdb.connect();c.execute("set memory_limit='2GB'");c.execute('set threads=2')
 m=json.loads((b/'dev-qualified-prediction-v1/manifest.json').read_text());ids=m['qualifiedIds']+m['excludedIds'];assert len(ids)==len(set(ids))==19
 c.execute('create table chosen(event_id varchar)');c.executemany('insert into chosen values (?)',[(x,)for x in ids])
 c.execute('create table e as select p.* from read_parquet(?) p join chosen using(event_id)',[str(b/'primary60_fit_manifest.parquet')])
 c.execute('create table dx as select e.event_id,d.icd_code,d.icd_version,d.seq_num from read_csv_auto(?,all_varchar=true) d join e on try_cast(d.hadm_id as bigint)=e.hadm_id and try_cast(d.subject_id as bigint)=e.subject_id',[str(raw/'hosp/diagnoses_icd.csv.gz')])
 c.execute('create table dictionary as select * from read_csv_auto(?,all_varchar=true)',[str(raw/'hosp/d_icd_diagnoses.csv.gz')])
 rows=c.execute('select dx.*,long_title from dx left join dictionary d on dx.icd_code=d.icd_code and dx.icd_version=d.icd_version order by event_id,try_cast(seq_num as integer)').fetchall();cols=[x[0]for x in c.description]
 diagnoses=[{**dict(zip(cols,r)),'source':'hospital discharge coding','available_before_cutoff':False,'temporal_status':'unknown; no diagnosis timestamp','permitted_use':'retrospective clinical context only; not fitter input','clinically_adjudicated':False}for r in rows]
 # Select the original latest complete arterial specimen, then recover raw component times.
 c.execute("create table specimens as select * from (select e.event_id,e.hadm_id,e.transition_time,a.specimen_id,a.charttime,a.ph,a.pco2,a.po2,row_number() over(partition by e.event_id order by a.charttime desc,a.specimen_id desc) rn from e join read_parquet(?) a on a.hadm_id=e.hadm_id and a.charttime between e.transition_time-interval '4 hours' and e.transition_time where a.ph is not null and a.pco2 is not null and a.po2 is not null) where rn=1",[str(b/'arterial_blood_gases.parquet')])
 labrows=c.execute('select s.event_id,s.transition_time,s.specimen_id,s.charttime as specimen_charttime,v.itemid,v.charttime,v.storetime,v.valuenum,v.valueuom from specimens s join read_parquet(?) v on v.hadm_id=s.hadm_id and v.specimen_id=s.specimen_id where v.itemid in (50820,50818,50821) and v.charttime<=s.transition_time',[str(b/'blood_gas_events.parquet')]).fetchall();cols=[x[0]for x in c.description]
 labs=[]
 for r in labrows:
  v=dict(zip(cols,r));v['strictly_available']=v['charttime']<v['transition_time'] and v['storetime'] is not None and v['storetime']<v['transition_time'];labs.append(v)
 case_status=[]
 for eid in ids:
  components=[x for x in labs if x['event_id']==eid]
  verified=all(any(x['itemid']==item and x['strictly_available'] for x in components)for item in [50820,50818,50821])
  case_status.append({'event_id':eid,'latest_complete_specimen_components_strictly_available':verified,'diagnosis_count':sum(x['event_id']==eid for x in diagnoses),'no_disease_control_assignment':True})
 report={'events':19,'retrospective_diagnosis_rows':len(diagnoses),'events_with_codes':sum(x['diagnosis_count']>0 for x in case_status),'events_latest_complete_abg_strictly_available':sum(x['latest_complete_specimen_components_strictly_available']for x in case_status),'lab_component_rows':len(labs),'lab_rows_strictly_available':sum(x['strictly_available']for x in labs),'postChangeOutcomeMeasurementsRead':False,'diagnosesUsedAsPredictionInputs':False,'caseAssignmentsMade':False,'limitations':['discharge codes can describe later complications','ties in latest specimen need extraction-identity review','raw component value agreement with original fitted targets not established here','lab storetime is availability proxy, not guaranteed bedside result-view timestamp','no imaging or clinical-note confirmation']}
 for name,value in [('retrospective_diagnosis_context.json',diagnoses),('prechange_abg_component_sources.json',labs),('disease_context_case_status.json',case_status),('disease_context_audit.json',report)]:
  with(out/name).open('x')as f:json.dump(value,f,indent=2,default=str)
 print(json.dumps(report))
if __name__=='__main__':extract(sys.argv[1],sys.argv[2])
