#!/usr/bin/env python3
"""Inspect case identity metadata only, never replay/result/output ledgers."""
from pathlib import Path
import json,sys,duckdb
b=Path(sys.argv[1]);c=duckdb.connect();mapping={}
for n in ['fit_event_index.parquet','primary60_fit_manifest.parquet']:
 for event,subject in c.execute('SELECT event_id,subject_id FROM read_parquet(?)',[str(b/n)]).fetchall():
  assert event not in mapping or mapping[event]==subject
  mapping[event]=subject
records=[];unknown=set();identified=set()
for p in sorted(b.glob('dev-*/manifest.json')):
 data=json.loads(p.read_text());ids=[]
 # Only explicit known identity fields, do not walk arbitrary results payloads.
 for k in ['cases','event_ids','eventIds']:
  if isinstance(data.get(k),list):
   for v in data[k]:
    if isinstance(v,str):ids.append(v)
    elif isinstance(v,dict)and isinstance(v.get('event_id'),str):ids.append(v['event_id'])
 for v in ids:
  if v in mapping:identified.add(mapping[v])
  else:unknown.add(v)
 records.append({'manifest':str(p.relative_to(b)),'explicitEventIds':len(set(ids)),'unmappedIds':len(set(ids)-mapping.keys()),'identityFieldsPresent':bool(ids)})
r={'manifestsInspected':len(records),'manifestsWithIdentityFields':sum(x['identityFieldsPresent']for x in records),'subjectsMapped':len(identified),'unmappedExplicitIds':len(unknown),'records':records,'newSubjectsBeyondCanonicalBridge':0,'completeHistoricalUseEstablished':False,'limitation':'only dev-*/manifest.json explicit identity arrays; absent identity field is not no prior use; no result or outcome ledger inspected'}
o=b/'candidate-pilot-prior-use-v1/nested_manifest_audit.json';o.write_text(json.dumps(r,indent=2));print(json.dumps(r))
