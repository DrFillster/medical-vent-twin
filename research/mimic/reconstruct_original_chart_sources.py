#!/usr/bin/env python3
"""Reproduce legacy chart selection order, exposing cutoff violations and ties."""
import json,sys
from pathlib import Path
import duckdb
from audit_prechange_chart_sources import MAP
b=Path(sys.argv[1]);c=duckdb.connect();c.execute("set memory_limit='2GB'");c.execute('set threads=2')
m=json.loads((b/'dev-qualified-prediction-v1/manifest.json').read_text());ids=m['qualifiedIds']+m['excludedIds'];c.execute('create table chosen(event_id varchar)');c.executemany('insert into chosen values (?)',[(x,)for x in ids])
c.execute('create table e as select p.* from read_parquet(?) p join chosen using(event_id)',[str(b/'primary60_fit_manifest.parquet')]);rows=c.execute('select * from e').fetchall();cols=[x[0]for x in c.description];events=[dict(zip(cols,r))for r in rows]
c.execute("create table sources as select e.event_id,v.* from e join read_parquet(?) v on v.stay_id=e.stay_id where v.charttime between e.transition_time-interval '2 hours' and e.transition_time and v.valuenum is not null",[str(b/'vent_chart_events.parquet')])
records=[]
for e in events:
 for field,items in MAP.items():
  source=c.execute('select itemid,charttime,storetime,valuenum,valueuom from sources where event_id=? and itemid in ('+','.join('?'for _ in items)+') order by charttime desc,storetime desc',[e['event_id'],*items]).fetchall()
  top=source[0] if source else None;ties=[r for r in source if top and r[1:3]==top[1:3]]
  reproduced=(top is None and e[field] is None)or(top is not None and top[3]==e[field])
  available=bool(top and top[1]<e['transition_time'] and top[2] is not None and top[2]<e['transition_time'])
  records.append({'event_id':e['event_id'],'field':field,'manifest_value':e[field],'selected_source':top,'reproduces_manifest':reproduced,'top_timestamp_ties':len(ties),'source_identity_ambiguous':len(ties)>1,'strictly_available':available,'same_time_as_transition':bool(top and top[1]==e['transition_time']),'unit_verified_for_fitting':False})
summary={'events':19,'field_checks':len(records),'reproduces_manifest':sum(r['reproduces_manifest']for r in records),'source_rows_present':sum(r['selected_source']is not None for r in records),'strictly_available':sum(r['strictly_available']for r in records),'same_charttime_as_transition':sum(r['same_time_as_transition']for r in records),'timestamp_ties':sum(r['source_identity_ambiguous']for r in records),'postTransitionMeasurementValuesRead':False,'unitWarning':'Compliance dictionary unit differs from expected construct; exclude numeric interpretation until raw unit/context verified'}
for name,value in [('original_chart_sources.json',records),('original_chart_source_audit.json',summary)]:
 with(b/'dev-disease-evidence-v1'/name).open('x')as f:json.dump(value,f,indent=2,default=str)
print(json.dumps(summary))
