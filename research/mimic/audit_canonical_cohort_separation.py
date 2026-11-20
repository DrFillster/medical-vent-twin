#!/usr/bin/env python3
"""Read identity/time columns only. No post-intervention outcome columns."""
from pathlib import Path
import json, hashlib, sys
import duckdb
b=Path(sys.argv[1]); out=b/'dev-qualified-prediction-v1'
c=duckdb.connect()
cols='event_id,subject_id,stay_id,transition_time,transition_itemid'
bridge={}
for name in ['fit_event_index.parquet','primary60_fit_manifest.parquet']:
    for row in c.execute(f'SELECT {cols} FROM read_parquet(?)',[str(b/name)]).fetchall():
        eid,subject,stay,time,item=row
        value=(int(subject),int(stay),str(time),int(item))
        if eid in bridge and bridge[eid]!=value: raise RuntimeError('conflicting canonical bridge')
        bridge[eid]=value
m=json.loads((out/'manifest.json').read_text())
current=m['qualifiedIds']+m['excludedIds']
assert len(current)==19 and len(set(current))==19
assert all(x in bridge for x in current)
def compare(ids,other):
    a=[bridge[x] for x in ids];d=[bridge[x] for x in other]
    subject={x[0] for x in d};stay={x[1] for x in d};events={(x[1],x[2],x[3]) for x in d}
    return {'subjectOverlappingEvents':sum(x[0] in subject for x in a),'stayOverlappingEvents':sum(x[1] in stay for x in a),'sameCanonicalEvent':sum((x[1],x[2],x[3]) in events for x in a),'uniqueOverlappingSubjects':len({x[0] for x in a}&subject)}
report={'engineeringOnly':True,'outcomeValuesRead':False,'historicalOutcomeAccessEstablished':False,'canonicalBridgeRows':len(bridge),'currentUniqueSubjects':len({bridge[x][0] for x in current}),'qualifiedUniqueSubjects':len({bridge[x][0] for x in m['qualifiedIds']}),'comparisons':{}}
for name in ['freeze3_dev_index.jsonl','blinded_event_index.jsonl','freeze2_event_index.jsonl','freeze3a_event_index.jsonl']:
    raw=(b/name).read_bytes();ids=[json.loads(x)['event_id'] for x in raw.decode().splitlines() if x.strip()]
    missing=[x for x in ids if x not in bridge]
    known=[x for x in ids if x in bridge]
    report['comparisons'][name]={'rows':len(ids),'missingBridge':len(missing),'indexSha256':hashlib.sha256(raw).hexdigest(),'all19':compare(current,known),'qualified10':compare(m['qualifiedIds'],known)}
report['independenceEstablished']=False
with (out/'canonical_separation_audit.json').open('x') as f: json.dump(report,f,indent=2);f.write('\n')
print(json.dumps(report))
