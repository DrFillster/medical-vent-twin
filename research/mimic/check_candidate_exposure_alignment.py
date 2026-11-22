#!/usr/bin/env python3
from pathlib import Path
import sys,json,duckdb,hashlib
b=Path(sys.argv[1]);o=b/'candidate-exposure-alignment-v1';r=json.loads((o/'summary.json').read_text());c=duckdb.connect()
for t in ['checks','airway','assessment']:c.execute('CREATE TABLE '+t+' AS SELECT * FROM read_parquet(?)',[str(o/(t+'.parquet'))])
assert c.execute('SELECT count(*),count(distinct event_key) FROM assessment').fetchone()==(r['inputEvents'],r['inputEvents'])
assert c.execute('SELECT count(*),count(distinct subject_id) FROM assessment WHERE documented_tube_route AND recorded_exposure_compatible').fetchone()==(r['bothEvents'],r['bothSubjects'])
assert c.execute('SELECT count(*) FROM checks WHERE matches AND NOT(earlier_setting_time<sample_time AND earlier_valid AND earlier_value=expected)').fetchone()[0]==0
assert c.execute('SELECT count(*) FROM assessment a WHERE recorded_exposure_compatible AND (SELECT count(*) FROM checks x WHERE x.event_key=a.event_key AND matches AND NOT later_conflict)<>16').fetchone()[0]==0
assert c.execute("SELECT count(*) FROM assessment WHERE documented_tube_route AND NOT(airway_value IN('Oral','Nasotracheal') AND airway_time<charttime AND airway_time>=charttime-INTERVAL '4 hours')").fetchone()[0]==0
for n,h in r['sourceHashes'].items():assert hashlib.file_digest((b/n).open('rb'),'sha256').hexdigest()==h
assert not r['outcomesRead']and not r['clinicalStabilityEstablished'];print('PASS all-input ledger, exact check grid, strict earlier setting support, positive airway documentary gate and source hashes')
