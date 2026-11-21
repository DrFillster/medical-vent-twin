#!/usr/bin/env python3
from pathlib import Path
import json,sys,math,hashlib
b=Path(sys.argv[1]);o=b/'dev-strict-acid-base-v1';lines=lambda n:[json.loads(x)for x in(o/n).read_text().splitlines()];d=json.loads((o/'manifest.json').read_text());s=json.loads((o/'summary.json').read_text());p={x['event_id']:x for x in json.loads((b/'dev-time-verified-replay-v1/packets.json').read_text())};pairs=lines('paired_review.jsonl');short=lines('refinement.jsonl');confirm=lines('confirmations.jsonl');sid=lines('sid_fits.jsonl')
assert len(pairs)==9 and len(confirm)==3 and len(sid)==3
assert len({(x['event_id'],x['condition'])for x in pairs})==9
assert all(abs(x['initializedPH']-p[x['event_id']]['targets']['ph'])<1e-6 for x in sid)
assert not any(x.get('error')for x in pairs+short+confirm)
for x in pairs+short+confirm:
 assert all(math.isfinite(x['final'][k])for k in ['pH','pao2MmHg','paco2MmHg'])
 assert not x['fullBaselineQualified']
 assert .2<=x['gasParameters']['deadSpace']<=.8 and .4<=x['gasParameters']['vpf']<=1
 assert x['checkpoints'][-1]['sec']==x['duration']
for eid in d['cases']:
 a=next(x for x in pairs if x['event_id']==eid and x['condition']=='fitted_sid_original');z=next(x for x in pairs if x['event_id']==eid and x['condition']=='fitted_sid_preserve_reference_venous_pco2');assert abs(a['initial']['pH']-p[eid]['targets']['ph'])<1e-6;assert a['sid']==z['sid'];assert a['controls']==z['controls'];assert a['gasParameters']==z['gasParameters']
for n,x in enumerate(confirm):print(json.dumps({'alias':'A'+str(n+1),'target':p[x['event_id']]['targets'],'initial':{k:x['initial'][k]for k in ['pH','pao2MmHg','paco2MmHg']},'final':{k:x['final'][k]for k in ['pH','pao2MmHg','paco2MmHg']},'mechanicalPass':x['mechanicalPass'],'gasPass':x['gasEndpointPass']}))
print(json.dumps(s));print('PASS bounded grid, initial pH fit, paired controls and parameters unchanged, finite free-evolution endpoints, no baseline qualification claim')
