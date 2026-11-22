#!/usr/bin/env python3
from pathlib import Path
import json,sys,duckdb,hashlib
b=Path(sys.argv[1]);o=b/'prechange-candidate-screen-v2';r=json.loads((o/'summary.json').read_text());c=duckdb.connect()
for t in ['flags','latest','lab_blocks','input_candidates']:c.execute('CREATE TABLE '+t+' AS SELECT * FROM read_parquet(?)',[str(o/(t+'.parquet'))])
c.execute('CREATE TABLE source AS SELECT row_number() OVER(ORDER BY subject_id,stay_id,itemid,charttime) event_key,* FROM read_parquet(?)',[str(b/'outcome-independent-transitions-v1/candidates.parquet')])
assert c.execute('SELECT count(*) FROM flags').fetchone()[0]==r['e']['events']
assert sum(x['events']for x in r['sequentialExclusions'])+r['chart_eligible']['events']==r['e']['events']
assert r['noAvailableCompleteArterialGasEvents']+r['input_candidates']['events']==r['chart_eligible']['events']
assert c.execute('SELECT count(*),count(distinct subject_id) FROM input_candidates').fetchone()==(r['input_candidates']['events'],r['input_candidates']['subjects'])
assert c.execute('SELECT count(*) FROM input_candidates e JOIN flags f USING(event_key) WHERE NOT(mode_pass AND fio2_pass AND peep_pass AND ps_pass AND vt_pass AND mv_pass AND rr_pass)').fetchone()[0]==0
assert c.execute('SELECT count(*) FROM input_candidates e WHERE NOT EXISTS(SELECT 1 FROM lab_blocks l WHERE l.event_key=e.event_key AND arterial AND no_conflicting_type AND ph AND co2 AND o2)').fetchone()[0]==0
assert c.execute("SELECT count(*) FROM latest l JOIN source e USING(event_key) WHERE NOT(l.charttime<e.charttime AND l.charttime>=e.charttime-INTERVAL '2 hours')").fetchone()[0]==0
assert c.execute("SELECT count(*) FROM lab_blocks l JOIN source e USING(event_key) WHERE NOT(l.charttime<e.charttime AND l.charttime>=e.charttime-INTERVAL '4 hours')").fetchone()[0]==0
for n,h in r['sourceHashes'].items():assert hashlib.file_digest((b/n).open('rb'),'sha256').hexdigest()==h
assert not r['readyForFitting']and not r['outcomeValuesRead']and not r['postChangeAvailabilityRequired'];print('PASS count conservation, chart flag gates, arterial specimen availability, strict pre-change windows, source hashes and unresolved eligibility retained')
