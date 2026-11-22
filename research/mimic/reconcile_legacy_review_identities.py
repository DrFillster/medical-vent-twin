#!/usr/bin/env python3
"""Reconstruct legacy EVT namespace exactly; project identity columns only."""
from pathlib import Path
import json,sys,duckdb,hashlib
b=Path(sys.argv[1]);o=b/'documented-airway-cohort-v1';c=duckdb.connect()
sample=b/'pilot_final_review_sample_100.parquet'
assert c.execute('SELECT count(*) FROM (SELECT itemid,transition_time,stay_id,count(*) n FROM read_parquet(?) GROUP BY ALL HAVING n>1)',[str(sample)]).fetchone()[0]==0,'ambiguous legacy row-number ordering'
rows=c.execute("SELECT printf('EVT-%03d',row_number() OVER(ORDER BY itemid,transition_time,stay_id)) event_id,subject_id,stay_id,transition_time,itemid FROM read_parquet(?)",[str(sample)]).fetchall();bridge={r[0]:r[1]for r in rows};assert len(bridge)==100
missing=set();details=[]
for name in ['pilot_review_timeline_100.parquet','pilot_review_confounders_100.parquet']:
 ids={r[0]for r in c.execute('SELECT DISTINCT event_id FROM read_parquet(?)',[str(b/name)]).fetchall()};missing.update(ids-bridge.keys());details.append({'file':name,'explicitIds':len(ids),'unmapped':len(ids-bridge.keys())})
assert not missing
old=[json.loads(x)for x in(o/'history_checked_subject_partition.jsonl').read_text().splitlines()];used=set(bridge.values());new=[r for r in old if r['subject_id']not in used]
with(o/'legacy_reconciled_subject_partition.jsonl').open('x')as f:
 for r in new:f.write(json.dumps(r)+'\n')
report={'legacyEventIdsReconstructed':len(bridge),'legacySubjects':len(used),'unmappedLegacyIds':len(missing),'checks':details,'additionalOverlapSubjects':len(old)-len(new),'remainingSubjects':len(new),'partitionCounts':{p:sum(r['partition']==p for r in new)for p in ['reserved_test','comparator_training']},'identityOnlyColumnsRead':True,'outcomeValuesRead':False,'allHistoricalUseCertified':False,'namespace':'EVT IDs local to final review sample, never merged with canonical namespace','sourceHashes':{n:hashlib.file_digest((b/n).open('rb'),'sha256').hexdigest()for n in ['pilot_final_review_sample_100.parquet','history_checked_subject_partition.jsonl'] if (b/n).exists()}}
report['sampleGeneratorHash']=hashlib.file_digest(Path('research/mimic/build_review_timelines.py').open('rb'),'sha256').hexdigest();(o/'legacy_identity_reconciliation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
