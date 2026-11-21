#!/usr/bin/env python3
"""Research fit bookkeeping; not a clinical accuracy calculator."""
from pathlib import Path
import json,sys,math
b=Path(sys.argv[1]);o=b/'dev-prechange-gas-ensemble-v1';d=json.loads((o/'manifest.json').read_text());s=json.loads((o/'summary.json').read_text());r=[json.loads(x)for x in(o/'candidates.jsonl').read_text().splitlines()];c=[json.loads(x)for x in(o/'confirmations.jsonl').read_text().splitlines()]
assert len(r)==d['mechanicalConfigs']*9==s['shortAttempts'];assert len(c)==len(d['cases'])==3
key=lambda x:(x['event_id'],*[x['controls'][k]for k in ['drive','elastic','capacity','resistance','transmission']],x['gasParameters']['deadSpace'],x['gasParameters']['vpf'])
assert len({key(x)for x in r})==len(r)
assert not any(x.get('error')for x in r+c)
for x in r+c:
 assert not x['fullBaselineQualified']and not x['pHQualified']
 assert all(math.isfinite(x['final'][k])for k in ['pao2MmHg','paco2MmHg','pH'])
 assert x['checkpoints'][-1]['sec']==x['duration']
 assert x['duration']in [60,600]
for x in c:
 candidates=[z for z in r if z['event_id']==x['event_id']and z['mechanicalPass']];best=min(candidates,key=lambda z:z['objective']);assert key(best)==key(x)
assert not d['outcomeFilesRead']and not d['legacyGasParametersRead']and not d['pHFit']
print(json.dumps(s));print('PASS complete unique gas grid, finite outputs, fresh confirmations, fixed controls, no clinical qualification claim')
for n,x in enumerate(c):print(json.dumps({'alias':'G'+str(n+1),'mechanicalPass':x['mechanicalPass'],'gasEndpointScreenPass':x['gasEndpointScreenPass'],'gasParameters':x['gasParameters'],'final':{k:x['final'][k]for k in ['pao2MmHg','paco2MmHg','pH']}}))
