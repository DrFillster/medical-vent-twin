#!/usr/bin/env python3
from pathlib import Path
import json,sys,math
b=Path(sys.argv[1]);o=b/'dev-final-bounded-gas-v1';lines=lambda n:[json.loads(x)for x in(o/n).read_text().splitlines()];d=json.loads((o/'manifest.json').read_text());s=json.loads((o/'summary.json').read_text());r=lines('candidates.jsonl');c=lines('confirmations.jsonl');assert len(r)==27 and len(c)==3;assert len({(x['event_id'],x['gasParameters']['deadSpace'],x['gasParameters']['vpf'])for x in r})==27
for x in r+c:
 assert not x.get('error');assert not x['fullBaselineQualified'];assert len(x['checkpoints'])==x['duration']//60
 assert all(z['mechanics']and all(math.isfinite(v)for v in z['mechanics'].values())for z in x['checkpoints'])
for x in c:
 best=min([z for z in r if z['event_id']==x['event_id']and z['multicheckMechanicalPass']],key=lambda z:z['lateObjective']);assert x['gasParameters']==best['gasParameters']and x['controls']==best['controls']and x['sid']==best['sid']
 assert all(math.isclose(next(z for z in x['checkpoints']if z['sec']==600)['gas'][k],best['final'][k],rel_tol=1e-8,abs_tol=1e-8)for k in ['pH','pao2MmHg','paco2MmHg'])
print(json.dumps(s));print('PASS bounded candidates, multi-check mechanical records, fixed winner confirmation and replay agreement')
p={x['event_id']:x for x in json.loads((b/'dev-time-verified-replay-v1/packets.json').read_text())}
for n,x in enumerate(c):print(json.dumps({'caseAlias':'F'+str(n+1),'target':p[x['event_id']]['targets'],'final':{k:x['final'][k]for k in ['pH','paco2MmHg','pao2MmHg']},'mechanicalPass':x['multicheckMechanicalPass'],'gasPass':x['gasEndpointPass']}))
