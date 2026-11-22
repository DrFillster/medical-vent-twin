#!/usr/bin/env python3
from pathlib import Path
import sys,json,hashlib,duckdb
b=Path(sys.argv[1]);o=b/'documented-airway-cohort-v1';c=duckdb.connect();load=lambda n:[json.loads(x)for x in(o/n).read_text().splitlines()]
a=load('assessment.jsonl');p=load('provisional_subject_partition.jsonl');h=load('history_checked_subject_partition.jsonl');f=load('legacy_reconciled_subject_partition.jsonl');s=json.loads((o/'summary.json').read_text());assert len(a)==s['assessedEvents'];assert len({x['event_key']for x in a})==len(a)
assert sum(x['documentedAirwaySpan']for x in a)==s['documentedSpanEvents']
for r in a:
 assert r['documentedAirwaySpan']==any(v['spanSupported']for v in r['families'].values())
 for v in r['families'].values():assert v['spanSupported']==(len(v['supportItems'])>=2 and not v['conflictItems'])
assert len({r['subject_id']for r in p})==len(p)
for r in p:
 digest=hashlib.sha256(('hummod-candidate-partition-v1:'+str(r['subject_id'])).encode()).hexdigest();assert digest==r['partitionHash'];assert r['partition']==('reserved_test'if int(digest[:8],16)%5==0 else 'comparator_training')
 earliest=min((x for x in a if x['subject_id']==r['subject_id']and x['documentedAirwaySpan']),key=lambda x:(x['transition_time'],x['itemid'],x['event_key']));assert earliest['event_key']==r['event_key']
assert set(x['subject_id']for x in f)<=set(x['subject_id']for x in h)<=set(x['subject_id']for x in p)
legacy={x[0]for x in c.execute('SELECT DISTINCT subject_id FROM read_parquet(?)',[str(b/'pilot_final_review_sample_100.parquet')]).fetchall()};assert not legacy.intersection(x['subject_id']for x in f)
for n,d in s['sourceHashes'].items():assert hashlib.file_digest((b/n).open('rb'),'sha256').hexdigest()==d
print('PASS complete cohort ledger, documentary predicates, one earliest event/subject, deterministic partition, nested exclusions, legacy subject separation and source hashes')
