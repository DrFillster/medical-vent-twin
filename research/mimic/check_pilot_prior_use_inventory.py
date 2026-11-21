#!/usr/bin/env python3
from pathlib import Path
import json,sys,duckdb
b=Path(sys.argv[1]);o=b/'candidate-pilot-prior-use-v1';r=json.loads((o/'inventory.json').read_text());rows=[json.loads(x)for x in(o/'candidate_identities.jsonl').read_text().splitlines()];c=duckdb.connect();used=set()
for name in ['fit_event_index.parquet','primary60_fit_manifest.parquet']:
 used.update(x[0]for x in c.execute('SELECT DISTINCT subject_id FROM read_parquet(?)',[str(b/name)]).fetchall())
assert len(used)==r['excludedHistoricalSubjects'];assert len(rows)==r['eventsOutsideMappedHistoricalSubjects'];assert not used.intersection(x['subject_id']for x in rows);assert len({x['subject_id']for x in rows})==r['subjectsOutsideMappedHistoricalSubjects'];assert not r['patientDisjointTestEstablished'];assert not r['outcomeValuesRead'];assert r['unmappedIndexedIds']==0
print('PASS candidate identities exclude mapped historical subjects; incomplete-history and selection limitations retained; identity-only contract')
