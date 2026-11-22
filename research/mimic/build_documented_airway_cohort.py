#!/usr/bin/env python3
"""Conservative documentary cohort; no prediction qualification or clinical stability claim."""
from pathlib import Path
import sys,json,re,hashlib
import duckdb
NEG={'not applicable','none'}
ETT={223837,223838,224415,224832}
TRACH={224829,224831}
def classify(item,value):
 if value is None:return 'unknown'
 s=value.strip().lower()
 if s in NEG:return 'negative'
 if item==223838:return 'positive' if s in {'oral-r','oral center','oral-l','nasal-l','nasal-r'}else 'unknown'
 if item==224832:return 'positive' if s in {'standard','double lumen'}else 'unknown'
 if item==224829:return 'positive' if s in {'perc trach','cuffed','standard','inner cannula','extra length','adjustable neck flange','tts (tight to shaft)','fenestrated'}else 'unknown'
 if item in {223837,224831}:return 'positive' if re.fullmatch(r'[0-9]+(?:\.[0-9]+)?mm',s) and float(s[:-2])>0 else 'unknown'
 if item==224415:return 'positive' if re.fullmatch(r'[0-9]+(?:\.[0-9]+)?cm',s) and float(s[:-2])>0 else 'unknown'
 return 'unknown' # route/new fields kept for review, never sole classification

def assess(rows,start,cutoff):
 families={}
 for name,items in [('ett',ETT),('trach',TRACH)]:
  supports=[];conflicts=[]
  for item in items:
   rs=[r for r in rows if r['itemid']==item and r['charttime']<cutoff and r['storetime']<cutoff]
   before=[r for r in rs if r['charttime']<start]
   if not before:continue
   last=max(r['charttime']for r in before);states={classify(item,r['value'])for r in before if r['charttime']==last}
   if states=={'positive'}:supports.append(item)
   # Every later nonpositive value of a previously supported field blocks span.
   if states=={'positive'} and any(classify(item,r['value'])!='positive'for r in rs if r['charttime']>=start):conflicts.append(item)
  # At least two device fields support the same family before all measurements.
  # Any same-family explicit negative after start blocks even another field.
  negatives=[r['itemid']for r in rows if r['itemid']in items and start<=r['charttime']<cutoff and r['storetime']<cutoff and classify(r['itemid'],r['value'])=='negative']
  families[name]={'supportItems':sorted(supports),'conflictItems':sorted(set(conflicts+negatives)),'spanSupported':len(supports)>=2 and not conflicts and not negatives}
 return {'families':families,'documentedAirwaySpan':any(f['spanSupported']for f in families.values())}

def main(b):
 o=b/'documented-airway-cohort-v1';o.mkdir(exist_ok=False);c=duckdb.connect()
 candidates=c.execute('SELECT * FROM read_parquet(?) WHERE recorded_exposure_compatible ORDER BY subject_id,charttime,itemid',[str(b/'candidate-exposure-alignment-v1/assessment.parquet')]).fetchdf().to_dict('records')
 devices=c.execute('SELECT * FROM read_parquet(?)',[str(b/'candidate-airway-devices-v1/device_events.parquet')]).fetchdf().to_dict('records');by={}
 for r in devices:by.setdefault((r['subject_id'],r['stay_id']),[]).append(r)
 checks=c.execute('SELECT event_key,min(sample_time) start,max(sample_time) last_sample FROM read_parquet(?) GROUP BY event_key',[str(b/'candidate-exposure-alignment-v1/checks.parquet')]).fetchall();times={x[0]:(x[1],x[2])for x in checks}
 ledger=[]
 for e in candidates:
  start,last=times[e['event_key']];rows=[r for r in by.get((e['subject_id'],e['stay_id']),[])if e['charttime'].__sub__(__import__('datetime').timedelta(hours=4))<=r['charttime']<e['charttime'] and r['storetime']<e['charttime']]
  result=assess(rows,start,e['charttime']);ledger.append({'event_key':e['event_key'],'subject_id':e['subject_id'],'stay_id':e['stay_id'],'hadm_id':e['hadm_id'],'itemid':e['itemid'],'transition_time':str(e['charttime']),'baseline_start':str(start),'baseline_last_sample':str(last),**result})
 with(o/'assessment.jsonl').open('x')as f:
  for r in ledger:f.write(json.dumps(r)+'\n')
 included=[x for x in ledger if x['documentedAirwaySpan']];subjects=sorted({x['subject_id']for x in included});selected=[]
 for subject in subjects:
  first=min((x for x in included if x['subject_id']==subject),key=lambda x:(x['transition_time'],x['itemid'],x['event_key']));digest=hashlib.sha256(('hummod-candidate-partition-v1:'+str(subject)).encode()).hexdigest();first={**first,'partition':'reserved_test'if int(digest[:8],16)%5==0 else 'comparator_training','partitionHash':digest};selected.append(first)
 with(o/'provisional_subject_partition.jsonl').open('x')as f:
  for r in selected:f.write(json.dumps(r)+'\n')
 summary={'assessedEvents':len(ledger),'documentedSpanEvents':len(included),'documentedSpanSubjects':len(subjects),'notSupportedOrUnknownEvents':len(ledger)-len(included),'ettSupportedEvents':sum(x['families']['ett']['spanSupported']for x in ledger),'trachSupportedEvents':sum(x['families']['trach']['spanSupported']for x in ledger),'partitionCounts':{p:sum(x['partition']==p for x in selected)for p in ['reserved_test','comparator_training']},'partitionStatus':'PROVISIONAL pending historical-use reconciliation, source QC and protocol; no test labels opened','oneEventPerSubject':True,'documentaryRule':'2 distinct same-family fields positive strictly before earliest baseline sample; no same-family later negative; latest positive-field later unknown/conflict blocks; 4h available records','clinicalStabilityProven':False,'airwayContinuityProven':False,'fittingPerformed':False,'postChangeOutcomesRead':False}
 summary['sourceHashes']={n:hashlib.file_digest((b/n).open('rb'),'sha256').hexdigest()for n in ['candidate-exposure-alignment-v1/assessment.parquet','candidate-exposure-alignment-v1/checks.parquet','candidate-airway-devices-v1/device_events.parquet']};(o/'summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary))
if __name__=='__main__':main(Path(sys.argv[1]))
