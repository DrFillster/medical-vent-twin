#!/usr/bin/env python3
"""Identity-column-only history audit. Review/fitting tables conservatively excluded."""
from pathlib import Path
import sys,json,duckdb,hashlib
b=Path(sys.argv[1]);o=b/'documented-airway-cohort-v1';c=duckdb.connect();bridge={};historical=set();details=[]
for n in ['fit_event_index.parquet','primary60_fit_manifest.parquet']:
 for eid,sub in c.execute('SELECT event_id,subject_id FROM read_parquet(?)',[str(b/n)]).fetchall():bridge[eid]=sub;historical.add(sub)
files=sorted(set(list(b.glob('pilot_*sample*.parquet'))+list(b.glob('pilot_*review*100.parquet'))+[b/n for n in ['phenotype_fit_plan.parquet','pretransition_phenotype_packet.parquet','controlled_mechanics_phenotypes.parquet','frozen_phenotypes.parquet','ps_prefit_targets.parquet']]))
unmapped=set()
for p in files:
 if not p.exists():continue
 cols={x[0]for x in c.execute('DESCRIBE SELECT * FROM read_parquet(?)',[str(p)]).fetchall()}
 if 'subject_id'in cols:
  ids={x[0]for x in c.execute('SELECT DISTINCT subject_id FROM read_parquet(?) WHERE subject_id IS NOT NULL',[str(p)]).fetchall()};historical.update(ids);details.append({'file':p.name,'identityColumn':'subject_id','subjects':len(ids)})
 elif 'event_id'in cols:
  ids={x[0]for x in c.execute('SELECT DISTINCT event_id FROM read_parquet(?)',[str(p)]).fetchall()};missing=ids-bridge.keys();unmapped.update(missing);historical.update(bridge[x]for x in ids if x in bridge);details.append({'file':p.name,'identityColumn':'event_id','events':len(ids),'unmapped':len(missing)})
 else:details.append({'file':p.name,'identityColumn':None})
partition=[json.loads(x)for x in(o/'provisional_subject_partition.jsonl').read_text().splitlines()];clean=[x for x in partition if x['subject_id']not in historical];overlap=[x for x in partition if x['subject_id']in historical]
with(o/'history_checked_subject_partition.jsonl').open('x')as f:
 for r in clean:f.write(json.dumps(r)+'\n')
report={'tablesInspected':len(details),'details':details,'extendedHistoricalSubjects':len(historical),'unmappedEventIds':len(unmapped),'provisionalSubjects':len(partition),'additionalHistoricalOverlapSubjects':len(overlap),'remainingSubjects':len(clean),'remainingPartitions':{p:sum(x['partition']==p for x in clean)for p in ['reserved_test','comparator_training']},'allProjectHistoricalUseCertified':False,'outcomeColumnsRead':False,'limitation':'local designated review/fitting/phenotype parquet identity columns only; other repos, branches and undocumented use not certified; subject exclusion can overexclude screening-only prior use'}
(o/'extended_history_audit.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
