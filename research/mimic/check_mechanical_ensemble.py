#!/usr/bin/env python3
"""Run-integrity audit; engineering screens are not clinical qualification."""
from pathlib import Path
import json,sys,math
b=Path(sys.argv[1]);out=b/'dev-mechanical-ensemble-v1';load=lambda n:json.loads((out/n).read_text());lines=lambda n:[json.loads(x)for x in(out/n).read_text().splitlines()];d=load('manifest.json');s=load('summary.json');e=lines('ensemble_confirmations.jsonl');j=lines('joint_search.jsonl')
key=lambda r:(r['event_id'],*[r['controls'][k]for k in ['drive','elastic','capacity','resistance','transmission']])
assert len(e)==d['longReplayUniqueCandidates']==len({key(x)for x in e})
assert len(j)==567==len({key(x)for x in j})
assert not any(x.get('error')for x in e+j)
assert len({x['event_id']for x in j})==1
assert s['ensembleLongScreenPass']==sum(x['engineeringPass']for x in e)
assert s['jointShortScreenPass']==sum(x['engineeringPass']for x in j)
for r in e+j:
 assert all(math.isfinite(v)and v>0 for v in r['model'].values())
assert s['jointBestConfirmation']and not s['jointBestConfirmation'].get('error')
assert not d['gasTargetsUsed']and not d['outcomeFilesRead']and not s['baselineGasQualified']
# Preserve all long-replay passing alternatives, not just the best.
retained=[{'event_id':r['event_id'],'controls':r['controls'],'provenance':'original mechanical ensemble, 600-second screen'}for r in e if r['engineeringPass']]
if s['jointBestConfirmation']['engineeringPass']:retained.append({'event_id':s['jointBest']['event_id'],'controls':s['jointBest']['controls'],'provenance':'joint failed-case search, best candidate 600-second screen'})
with(out/'retained_mechanical_configs.json').open('x')as f:json.dump({'clinicalGasQualified':False,'gasFittingAuthorized':False,'configs':retained,'pending':'co-temporal input review then pre-change-only gas fitting'},f,indent=2)
print(json.dumps({k:v for k,v in s.items()if k not in ['jointBest','jointBestConfirmation']}));print('joint_best_controls',s['jointBest']['controls']);print('joint_best_model',s['jointBest']['model']);print('joint_confirmation_pass',s['jointBestConfirmation']['engineeringPass']);print('retained_configurations',len(retained));print('PASS unique attempts, all finite, no execution errors, long replay screen accounting, no gas-qualification claim')
