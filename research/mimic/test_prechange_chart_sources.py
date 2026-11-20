#!/usr/bin/env python3
import tempfile,json,contextlib,io
from pathlib import Path
import duckdb
from audit_prechange_chart_sources import audit,MAP
with tempfile.TemporaryDirectory() as tmp:
 b=Path(tmp);(b/'dev-qualified-prediction-v1').mkdir();(b/'dev-disease-evidence-v1').mkdir()
 ids=[str(i)for i in range(19)];(b/'dev-qualified-prediction-v1/manifest.json').write_text(json.dumps({'qualifiedIds':ids[:10],'excludedIds':ids[10:]}))
 c=duckdb.connect();c.execute('create table e(event_id varchar,stay_id bigint,transition_time timestamp,'+','.join(x+' double'for x in MAP)+')')
 for i in range(19):c.execute('insert into e values ('+','.join('?'for _ in range(16))+')',[str(i),i,'2020-01-01 12:00:00',*[80 if x=='pre_hr' else None for x in MAP]])
 c.execute('create table v(stay_id bigint,itemid bigint,charttime timestamp,storetime timestamp,valuenum double,valueuom varchar)')
 for i in range(19):
  chart='2020-01-01 11:00:00' if i!=2 else '2020-01-01 12:00:00';store='2020-01-01 11:10:00' if i!=1 else '2020-01-01 12:01:00'
  c.execute('insert into v values (?,220045,?,?,80,?)',[i,chart,store,'bpm'])
 for table,name in [('e','primary60_fit_manifest.parquet'),('v','vent_chart_events.parquet')]:c.execute('copy '+table+' to ? (format parquet)',[str(b/name)])
 with contextlib.redirect_stdout(io.StringIO()):audit(b)
 r=json.loads((b/'dev-disease-evidence-v1/chart_source_records.json').read_text());hr={x['event_id']:x for x in r if x['field']=='pre_hr'}
 assert hr['0']['status']=='matching_pre_cutoff_record'
 assert hr['1']['status']=='matching_but_late_or_unknown_storetime'
 assert hr['2']['status']=='no_strict_pre_cutoff_match'
 assert len(r)==247 and not any(x['exact_original_source_verified'] for x in r)
print('PASS: 19 cases, strict chart cutoff, late-store exclusion, explicit candidate-only provenance')
