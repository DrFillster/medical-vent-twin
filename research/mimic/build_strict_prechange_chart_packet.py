#!/usr/bin/env python3
"""New research packet, not a rewrite of saved baseline fits; retain raw units."""
from pathlib import Path
import json,sys
import duckdb
from audit_prechange_chart_sources import MAP
b=Path(sys.argv[1]);c=duckdb.connect();c.execute("set memory_limit='2GB'");c.execute('set threads=2')
m=json.loads((b/'dev-qualified-prediction-v1/manifest.json').read_text());ids=m['qualifiedIds']+m['excludedIds'];assert len(ids)==len(set(ids))==19
c.execute('create table chosen(event_id varchar)');c.executemany('insert into chosen values (?)',[(x,)for x in ids])
c.execute('create table e as select p.* from read_parquet(?) p join chosen using(event_id)',[str(b/'primary60_fit_manifest.parquet')])
c.execute("create table sources as select e.event_id,v.* from e join read_parquet(?) v on v.stay_id=e.stay_id where v.charttime >= e.transition_time-interval '2 hours' and v.charttime<e.transition_time and v.storetime<e.transition_time and v.valuenum is not null",[str(b/'vent_chart_events.parquet')])
rows=c.execute('select * from e').fetchall();cols=[x[0]for x in c.description];records=[]
for r in rows:
 e=dict(zip(cols,r));fields={}
 for field,items in MAP.items():
  options=c.execute('select itemid,charttime,storetime,valuenum,valueuom from sources where event_id=? and itemid in ('+','.join('?'for _ in items)+') order by charttime desc,storetime desc',[e['event_id'],*items]).fetchall()
  top=options[0]if options else None;ties=[x for x in options if top and x[1:3]==top[1:3]]
  ambiguous=len(ties)>1;unit_hold=field in ['pre_resistance','pre_compliance_documented']
  fields[field]={'raw_source':top,'same_timestamp_candidates':ties if ambiguous else [],'missing':top is None,'matches_saved_manifest':bool(top and top[3]==e[field]),'time_verified':top is not None,'eligible_for_numeric_fitting':bool(top and not ambiguous and not unit_hold),'reason':'missing'if not top else ('ambiguous timestamp'if ambiguous else ('measurement type/units require review'if unit_hold else 'available raw measurement; clinical context still required'))}
 records.append({'event_id':e['event_id'],'cutoff':e['transition_time'],'fields':fields,'disease_assignment':None,'prediction_ready':False,'remaining_dependencies':['ventilator setting provenance','blood gas target/source agreement','clinical context and parameter identifiability']})
flat=[x for r in records for x in r['fields'].values()];summary={'events':len(records),'field_checks':len(flat),'raw_pre_cutoff_sources':sum(x['time_verified']for x in flat),'eligible_unambiguous_raw_fields':sum(x['eligible_for_numeric_fitting']for x in flat),'matching_saved_values':sum(x['matches_saved_manifest']for x in flat),'newPacketOnly':True,'savedFitsChanged':False,'predictionReady':False}
for name,value in [('strict_prechange_chart_packet.json',records),('strict_prechange_chart_packet_audit.json',summary)]:
 with(b/'dev-disease-evidence-v1'/name).open('x')as f:json.dump(value,f,indent=2,default=str)
print(json.dumps(summary))
