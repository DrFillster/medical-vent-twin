#!/usr/bin/env python3
"""Engineering selection integrity only; not a validated clinical score."""
from pathlib import Path
import json,sys,math,hashlib
b=Path(sys.argv[1]);o=b/'dev-long-horizon-ensemble-v1';lines=lambda n:[json.loads(z)for z in(o/n).read_text().splitlines()];d=json.loads((o/'manifest.json').read_text());s=json.loads((o/'summary.json').read_text());r=lines('candidates.jsonl');c=lines('confirmations.jsonl');key=lambda x:(x['event_id'],*[x['controls'][k]for k in ['drive','elastic','capacity','resistance','transmission']])
assert len(r)==31==len({key(x)for x in r});assert len(c)==3
for n,h in d['hashes'].items():assert hashlib.sha256((b/n).read_bytes()).hexdigest()==h
for x in r+c:
 assert not x.get('error');assert not x['fullBaselineQualified']
 assert x['checkpoints'][-1]['sec']==x['duration']
 assert all(math.isfinite(x['final'][k])for k in ['pH','pao2MmHg','paco2MmHg'])
for x in c:
 best=min([z for z in r if z['event_id']==x['event_id']and z['mechanicalPass']],key=lambda z:z['longObjective']);assert key(x)==key(best);assert x['sid']==best['sid']and x['gasParameters']==best['gasParameters']
 assert all(math.isclose(next(z for z in x['checkpoints']if z['sec']==600)['gas'][k],best['final'][k],rel_tol=1e-8,abs_tol=1e-8)for k in ['pH','paco2MmHg','pao2MmHg'])
print(json.dumps(s));print('PASS complete unique ensemble, unchanged inputs, long-horizon winner selection, no confirmation retuning, fresh replay agreement')
p={x['event_id']:x for x in json.loads((b/'dev-time-verified-replay-v1/packets.json').read_text())}
for i,x in enumerate(c):print(json.dumps({'alias':'L'+str(i+1),'targets':p[x['event_id']]['targets'],'controls':x['controls'],'gas':{k:x['final'][k]for k in ['pH','paco2MmHg','pao2MmHg']},'mechanicalPass':x['mechanicalPass'],'gasPass':x['gasEndpointPass']}))
