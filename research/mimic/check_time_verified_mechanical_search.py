#!/usr/bin/env python3
"""Audit search completeness and time gates, without declaring clinical validation."""
from pathlib import Path
import json,sys,math
b=Path(sys.argv[1]);out=b/'dev-time-verified-replay-v1'
p=json.loads((out/'packets.json').read_text());d=json.loads((out/'mechanical_search_design.json').read_text());r=json.loads((out/'mechanical_fit_results.json').read_text());attempts=[json.loads(x)for x in(out/'mechanical_candidates.jsonl').read_text().splitlines()]
assert len(p)==19 and len(r)==len(d['cases'])==4 and len(attempts)==352
assert {x['event_id']for x in r}==set(d['cases'])
for x in p:
 if x['input_time_gate_pass']:
  assert all(v and v[0]<x['cutoff']and v[1]<x['cutoff']for v in x['setting_sources'].values())
  assert all(v[1]<x['cutoff']and v[2]<x['cutoff']for v in x['abg_source']['component_sources'])
  assert not x['prior_prefit_reuse_permitted']and not x['new_prediction_ready']
for x in r:
 assert x['attempts']==88 and x['executionErrors']==0 and not x['clinicalGasQualified']
 assert x['best']['objective']<=x['reference']['objective']
 assert all(math.isfinite(v)and v>0 for v in x['confirmation']['model'].values())
summary={'casesScreened':19,'completeTimeVerifiedInputs':4,'searchSimulations':len(attempts),'confirmationRuns':len(r),'searchExecutionErrors':sum('error'in x for x in attempts),'shortEngineeringScreenPass':sum(x['best']['engineeringPass']for x in r),'confirmationEngineeringScreenPass':sum(x['confirmation']['engineeringPass']for x in r),'casesWithMultiplePassingCandidates':sum(x['multiplePassingControls']>1 for x in r),'fitNotUnique':True,'baselineGasQualificationEvaluated':False,'outcomesReadBySearch':False,'independentValidation':False}
with(out/'mechanical_contract_summary.json').open('x')as f:json.dump(summary,f,indent=2)
print(json.dumps(summary))
for n,x in enumerate(r):print(json.dumps({'alias':'T'+str(n+1),'targets':x['targets'],'reference':x['reference']['model'],'best':x['best']['model'],'controls':x['best']['controls'],'confirmation':x['confirmation']['model'],'shortPass':x['best']['engineeringPass'],'longPass':x['confirmation']['engineeringPass'],'passingCandidates':x['multiplePassingControls']}))
