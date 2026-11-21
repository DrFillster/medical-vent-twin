#!/usr/bin/env python3
from pathlib import Path
import json,sys,hashlib,math
b=Path(sys.argv[1]);o=b/'dev-declared-recruitment-replay-v1';d=json.loads((o/'manifest.json').read_text());rows=[json.loads(x)for x in(o/'replays.jsonl').read_text().splitlines()];assert len(rows)==12==len({(x['event_id'],x['arm'],x['scenario'])for x in rows});assert not any(x.get('error')for x in rows)
root=Path.cwd()
for n,h in d['sourceHashes'].items():assert hashlib.sha256((root/n).read_bytes()).hexdigest()==h
for n,h in d['inputHashes'].items():assert hashlib.sha256((b/n).read_bytes()).hexdigest()==h
seeds={x['event_id']:x for x in [json.loads(z)for z in(b/'dev-final-bounded-gas-v1/confirmations.jsonl').read_text().splitlines()]};fits={x['event_id']:x for x in json.loads((b/'dev-time-verified-replay-v1/mechanical_fit_results.json').read_text())}
for r in rows:
 assert len(r['checkpoints'])==35
 for k in ['controls','gasParameters','sid']:assert r[k]==seeds[r['event_id']][k]
 if r['arm']=='declared':
  for k in ['P_open','P_close','k_open','k_close']:assert r['effectiveKinetics'][k]==r['effectiveKinetics']['recruitment'][k]
for eid in d['cases']:
 for arm in d['arms']:
  a=next(x for x in rows if x['event_id']==eid and x['arm']==arm and x['scenario']=='unchanged');z=next(x for x in rows if x['event_id']==eid and x['arm']==arm and x['scenario']=='synthetic_fio2_step');assert a['checkpoints'][:30]==z['checkpoints'][:30]
 legacy=next(x for x in rows if x['event_id']==eid and x['arm']=='legacy'and x['scenario']=='unchanged');base=legacy['checkpoints'][29]
 for k in ['pH','paco2MmHg','pao2MmHg']:assert math.isclose(base['gas'][k],seeds[eid]['final'][k],rel_tol=1e-8,abs_tol=1e-8)
print('PASS 12 complete unique replays, source/input hashes, fixed fitted parameters, declared kinetics, pre-step paired identity and legacy replay agreement')
for i,eid in enumerate(d['cases']):
 for arm in d['arms']:
  a=next(x for x in rows if x['event_id']==eid and x['arm']==arm and x['scenario']=='unchanged');z=a['checkpoints'][29];target=fits[eid]['targets'];passed=all(abs(z['mechanics'][k]/v-1)<=.2 for k,v in target.items());print(json.dumps({'alias':i+1,'arm':arm,'baselineGas':{k:z['gas'][k]for k in ['pH','paco2MmHg','pao2MmHg']},'baselineMechanicalPass':passed}))
