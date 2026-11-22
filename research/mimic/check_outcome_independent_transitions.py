#!/usr/bin/env python3
from pathlib import Path
import json,sys,hashlib,duckdb
b=Path(sys.argv[1]);o=b/'outcome-independent-transitions-v1';r=json.loads((o/'summary.json').read_text());c=duckdb.connect()
c.execute('CREATE TABLE candidates AS SELECT * FROM read_parquet(?)',[str(o/'candidates.parquet')]);c.execute('CREATE TABLE historical AS SELECT subject_id FROM read_parquet(?) UNION SELECT subject_id FROM read_parquet(?)',[str(b/'fit_event_index.parquet'),str(b/'primary60_fit_manifest.parquet')]);c.execute('CREATE TABLE adults AS SELECT subject_id,stay_id,intime,outtime FROM read_parquet(?)',[str(b/'adult_icustays.parquet')])
assert c.execute('SELECT count(*) FROM candidates JOIN historical USING(subject_id)').fetchone()[0]==0
assert c.execute('SELECT count(*) FROM candidates').fetchone()[0]==r['candidates']['rows']
assert c.execute('SELECT count(distinct subject_id) FROM candidates').fetchone()[0]==r['candidates']['subjects']
assert c.execute('SELECT count(*) FROM (SELECT subject_id,stay_id,itemid,charttime,count(*) n FROM candidates GROUP BY ALL HAVING n<>1)').fetchone()[0]==0
assert c.execute("SELECT count(*) FROM candidates WHERE NOT(prev_charttime<charttime AND prev_storetime<charttime AND prior_available_before_change AND recognition_time>=charttime AND recognition_time>=last_storetime AND distinct_values=1 AND all_values_valid AND numbers_complete AND storetimes_complete AND abs(setting-prev_setting)>=CASE itemid WHEN 223835 THEN 10 ELSE 2 END)").fetchone()[0]==0
assert c.execute('SELECT count(*) FROM candidates x WHERE NOT EXISTS(SELECT 1 FROM adults a WHERE a.subject_id=x.subject_id AND a.stay_id=x.stay_id AND x.charttime>=a.intime AND x.charttime<a.outtime)').fetchone()[0]==0
for n,h in r['sourceHashes'].items():assert hashlib.file_digest((b/n).open('rb'),'sha256').hexdigest()==h
assert not r['newTestCohortEstablished']and not r['outcomeValuesRead'];print('PASS counts, unique event blocks, subject exclusions, adult-stay timing, prior availability, material changes and source hashes')
