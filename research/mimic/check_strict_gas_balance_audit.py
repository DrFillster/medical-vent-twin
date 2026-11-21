#!/usr/bin/env python3
"""Instrumentation/run integrity, not clinical scoring or whole-body conservation."""
from pathlib import Path
import json,sys,math
b=Path(sys.argv[1]);o=b/'dev-strict-gas-balance-v1';r=[json.loads(x)for x in(o/'samples.jsonl').read_text().splitlines()];d=json.loads((o/'manifest.json').read_text());seed={x['event_id']:x for x in [json.loads(z)for z in(b/'dev-strict-acid-base-v1/confirmations.jsonl').read_text().splitlines()]}
assert len(r)==183 and len({(x['event_id'],x['timeSec'])for x in r})==183
for eid in d['cases']:
 rows=[x for x in r if x['event_id']==eid];assert [x['timeSec']for x in rows]==list(range(0,1801,30))
 for x in rows:
  assert all(math.isfinite(x['sessionGas'][k])for k in ['pH','paco2MmHg','pao2MmHg'])
  assert x['core']['boundary']['metabolism']==rows[0]['core']['boundary']['metabolism']
  assert x['core']['boundary']['blood']['sidMolPerL']==seed[eid]['sid']
  assert x['core']['boundary']['ventilation']['fio2']==rows[0]['core']['boundary']['ventilation']['fio2']
 middle=next(x for x in rows if x['timeSec']==600)
 for k in ['pH','paco2MmHg','pao2MmHg']:assert math.isclose(middle['sessionGas'][k],seed[eid]['final'][k],rel_tol=1e-8,abs_tol=1e-8),'observer/replay regression'
summary={'cases':3,'runs':3,'durationSec':1800,'samples':len(r),'finiteGasOutputs':True,'prior600SecReplayAgreement':True,'retuned':False,'clinicalBaselineQualified':False,'wholeBodyConservationEstablished':False,'outcomeFilesRead':False}
with(o/'contract_summary.json').open('x')as f:json.dump(summary,f,indent=2)
print(json.dumps(summary))
