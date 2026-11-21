#!/usr/bin/env python3
"""Exploratory raw outcome comparison; no independent accuracy claim."""
import json,sys,hashlib
from pathlib import Path
import duckdb
b=Path(sys.argv[1]);out=b/'dev-similar-settings-v1';m=json.loads((out/'manifest.json').read_text());ids=[x for g in m['groups']for x in g['ids']];q=set(json.loads((b/'dev-qualified-prediction-v1/manifest.json').read_text())['qualifiedIds'])
design={'selectedBeforeOutcomeAccess':True,'selectionManifestSha256':hashlib.sha256((out/'manifest.json').read_bytes()).hexdigest(),'window':'45 to 75 minutes after transition; nearest 60 minutes; charttime then specimen_id tie break','comparison':'raw clinical measurements vs nearest saved 5-minute-grid predictions and persistence; no interpolated physiology','developmentOnly':True,'outcomesUnblindedByThisScript':True,'postTransitionSettingsAudited':False,'noRetuning':True}
with(out/'outcome_inspection_design.json').open('x')as f:json.dump(design,f,indent=2)
c=duckdb.connect();c.execute('create table chosen(event_id varchar)');c.executemany('insert into chosen values (?)',[(x,)for x in ids]);c.execute('create table e as select p.event_id,p.hadm_id,p.transition_time from read_parquet(?) p join chosen using(event_id)',[str(b/'primary60_fit_manifest.parquet')])
rows=c.execute("select * from (select e.event_id,a.charttime,a.ph,a.pco2,a.po2,date_diff('second',e.transition_time,a.charttime) elapsed_sec,row_number() over(partition by e.event_id order by abs(date_diff('second',e.transition_time,a.charttime)-3600),a.charttime,a.specimen_id) rn from e join read_parquet(?) a on a.hadm_id=e.hadm_id and a.charttime between e.transition_time+interval '45 minutes' and e.transition_time+interval '75 minutes' where a.ph is not null and a.pco2 is not null and a.po2 is not null) where rn=1",[str(b/'arterial_blood_gases.parquet')]).fetchall();cols=[x[0]for x in c.description];observed={x['event_id']:x for x in [dict(zip(cols,r))for r in rows]}
pred=[json.loads(x)for x in (b/'dev-qualified-prediction-v1/predictions.jsonl').read_text().splitlines()if x];prefit={x['event_id']:x for x in json.loads((b/'primary60_conservative_prefit.json').read_text())};records=[]
for i,eid in enumerate(ids):
 row={'case_alias':'S'+str(i+1),'event_id':eid,'baselineQualified':eid in q,'observed':observed.get(eid),'comparisonEligible':False}
 if eid in observed:
  candidates=[x for x in pred if x['event_id']==eid and x['arm']=='observed_fio2_change' and not x.get('error')]
  if candidates:
   t=observed[eid]['elapsed_sec'];r=candidates[0];row['prediction']=min(r['predictions'],key=lambda x:(abs(x['sec']-t),x['sec']));row['persistence']={k:prefit[eid]['targets'][k]for k in ['ph','pco2','po2']};row['comparisonEligible']=True
 row['causalInterpretationPermitted']=False;records.append(row)
summary={'selectedCases':len(ids),'withObservedGasInWindow':len(observed),'withQualifiedSavedPredictionAndObservedGas':sum(x['comparisonEligible']for x in records),'baselineFailuresRetained':sum(not x['baselineQualified']for x in records),'developmentOnly':True,'postTransitionConfoundersNotYetAudited':True}
for n,v in [('raw_outcome_comparisons.json',records),('outcome_inspection_summary.json',summary)]:
 with(out/n).open('x')as f:json.dump(v,f,indent=2,default=str)
print(json.dumps(summary))
for r in records:
 if r['comparisonEligible']:print(json.dumps({k:r[k]for k in ['case_alias','observed','prediction','persistence']},default=str))
