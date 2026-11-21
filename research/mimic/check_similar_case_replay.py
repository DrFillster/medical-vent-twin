#!/usr/bin/env python3
"""Contract check only: not an accuracy score or physiological qualification."""
from pathlib import Path
import json,sys,math
b=Path(sys.argv[1]);out=b/'dev-explicit-similar-replay-v2';manifest=json.loads((out/'manifest.json').read_text());rows=[json.loads(x)for x in(out/'runs.jsonl').read_text().splitlines()]
assert len(manifest['ids'])==len(set(manifest['ids']))==3
assert len(rows)==6 and len({(r['event_id'],r['arm'])for r in rows})==6
assert {(r['event_id'],r['arm'])for r in rows}=={(e,a)for e in manifest['ids']for a in manifest['arms']}
assert not any(r.get('error')for r in rows)
for r in rows:
 assert r['initialGasesExactlyEqual'] and r['legacyParametersEquivalentWithinRelativeTolerance']==1e-12
 assert r['durationSec']==r['observed']['elapsed_sec']
 assert all(math.isfinite(r['final'][k])for k in ['pao2MmHg','paco2MmHg','pH'])
 assert r['elapsedSimulatorTime']==r['durationSec']
 # Save only raw endpoints; do not compute a clinical accuracy score.
qualified={r['event_id']for r in rows if r['baselineQualified']};assert len(qualified)==1
summary={'cases':3,'pairedRuns':6,'executionErrors':0,'previouslyQualifiedCases':1,'previouslyFailedCases':2,'rawOutcomesTimeAligned':True,'parametersRetuned':False,'prospectiveValidation':False,'newDiseaseStateFitting':False,'baselineFailuresRescued':False}
with(out/'contract_summary.json').open('x')as f:json.dump(summary,f,indent=2)
print(json.dumps(summary))
for index,eid in enumerate(manifest['ids']):
 r=next(x for x in rows if x['event_id']==eid and x['arm']=='recorded_fio2');n=next(x for x in rows if x['event_id']==eid and x['arm']=='unchanged')
 print(json.dumps({'alias':'D'+str(index+1),'baselineQualified':r['baselineQualified'],'observed':{k:r['observed'][k]for k in ['po2','pco2','ph']},'predicted':{k:r['final'][k]for k in ['pao2MmHg','paco2MmHg','pH']},'noChange':{k:n['final'][k]for k in ['pao2MmHg','paco2MmHg','pH']}}))
