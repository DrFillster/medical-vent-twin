#!/usr/bin/env python3
"""Conservative historical identity inventory. SQL projects identity columns only."""
from pathlib import Path
import json,hashlib,sys
import duckdb
b=Path(sys.argv[1]);o=b/'candidate-pilot-prior-use-v1';o.mkdir(exist_ok=True);c=duckdb.connect();bridge={};sources={};conflicts=0
for name in ['fit_event_index.parquet','primary60_fit_manifest.parquet']:
 rows=c.execute('SELECT event_id,subject_id,stay_id,transition_time FROM read_parquet(?)',[str(b/name)]).fetchall()
 for eid,subject,stay,t in rows:
  identity=(int(subject),int(stay),str(t))
  if eid in bridge and bridge[eid]!=identity:raise RuntimeError('conflicting identity')
  bridge[eid]=identity
 sources[name]={'rows':len(rows),'role':'conservatively excluded historical fitting inventory'}
used={v[0]for v in bridge.values()};unmapped=set()
for file in sorted(b.glob('*index*.jsonl')):
 ids=[json.loads(x).get('event_id')for x in file.read_text().splitlines()if x.strip()];missing={x for x in ids if x not in bridge};unmapped.update(missing)
 sources[file.name]={'rows':len(ids),'unmappedIds':len(missing),'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'role':'conservative prior-use exclusion, not assertion of outcome exposure'}
 for eid in ids:
  if eid in bridge:used.add(bridge[eid][0])
# SQL does not select post-ABG values/times, medications or outcome availability.
pool=c.execute('SELECT DISTINCT subject_id,stay_id,transition_time,itemid FROM read_parquet(?)',[str(b/'pilot_supported_mode_pool.parquet')]).fetchall();candidate=[r for r in pool if int(r[0])not in used]
report={'sourceInventory':sources,'bridgeEvents':len(bridge),'excludedHistoricalSubjects':len(used),'unmappedIndexedIds':len(unmapped),'poolEvents':len(pool),'poolSubjects':len({r[0]for r in pool}),'eventsOutsideMappedHistoricalSubjects':len(candidate),'subjectsOutsideMappedHistoricalSubjects':len({r[0]for r in candidate}),'eligibilityEstablished':False,'completePriorUseEstablished':False,'patientDisjointTestEstablished':False,'outcomeValuesRead':False,'limitation':'pool was previously constructed using downstream data; identities outside mapped history are candidates, NOT a new independent cohort'}
with(o/'inventory.json').open('x')as f:json.dump(report,f,indent=2)
with(o/'candidate_identities.jsonl').open('x')as f:
 for subject,stay,t,item in candidate:f.write(json.dumps({'subject_id':subject,'stay_id':stay,'transition_time':str(t),'itemid':item})+'\n')
print(json.dumps(report))
