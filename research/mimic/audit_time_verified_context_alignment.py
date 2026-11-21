#!/usr/bin/env python3
"""Availability alone is not measurement/setting alignment. No outcomes read."""
from pathlib import Path
import json,sys
import duckdb
b=Path(sys.argv[1]);out=b/'dev-time-verified-replay-v1';packets=json.loads((out/'packets.json').read_text());mechanics={x['event_id']:x for x in json.loads((b/'dev-disease-evidence-v1/strict_prechange_chart_packet.json').read_text())};c=duckdb.connect();c.execute("set memory_limit='2GB'");c.execute('set threads=2')
c.execute('create table chosen(event_id varchar)');c.executemany('insert into chosen values (?)',[(x['event_id'],)for x in packets]);c.execute('create table e as select p.event_id,p.stay_id,p.transition_time from read_parquet(?) p join chosen using(event_id)',[str(b/'primary60_fit_manifest.parquet')]);c.execute("create table v as select e.event_id,e.transition_time,v.* from e join read_parquet(?) v on v.stay_id=e.stay_id where v.charttime>=e.transition_time-interval '6 hours' and v.charttime<e.transition_time and v.storetime<e.transition_time",[str(b/'vent_chart_events.parquet')])
items={'fio2_percent':223835,'peep':220339,'psv':224701,'mode':223849}
records=[]
for p in packets:
 if not p['input_time_gate_pass']:continue
 eid=p['event_id'];times={k:mechanics[eid]['fields'][field]['raw_source'][1]for k,field in [('vt_ml','pre_vt_observed'),('mv_l_min','pre_minute_volume'),('rr_min','pre_rr_total')]if mechanics[eid]['fields'][field]['raw_source']};times['abg']=p['abg_source']['charttime'];checks=[]
 for measurement,time in times.items():
  for label,item in items.items():
   rows=c.execute('select charttime,storetime,valuenum,value from v where event_id=? and itemid=? and charttime<=cast(? as timestamp) order by charttime desc,storetime desc',[eid,item,time]).fetchall();latest=rows[0]if rows else None;expected=p['vent'][label];matches=bool(latest and (latest[3]if label=='mode'else latest[2])==expected)
   subsequent=c.execute('select charttime,storetime,valuenum,value from v where event_id=? and itemid=? and charttime>cast(? as timestamp) order by charttime,storetime',[eid,item,time]).fetchall();differences=[r for r in subsequent if (r[3]if label=='mode'else r[2])!=expected]
   checks.append({'measurement':measurement,'setting':label,'measurement_time':time,'latest_at_or_before_sample':latest,'same_chart_time_order_ambiguous':bool(latest and str(latest[0])==time),'matches_cutoff_setting':matches,'later_different_setting_records':differences,'same_time_does_not_establish_order':True})
  # Later-stored records before cutoff may establish retrospective context, not prospective availability at the sample time.
 records.append({'event_id':eid,'measurement_times':times,'checks':checks,'all_measurement_settings_documented_matching':all(x['matches_cutoff_setting']for x in checks),'any_later_different_records':any(x['later_different_setting_records']for x in checks),'alignment_confirmed':False,'notes':'same-time ordering, documentation gaps and chart-unit context require review; no absence-of-change inference'})
summary={'timeEligibleCases':len(records),'allSampleSettingsHaveMatchingEarlierOrSameTimeRecord':sum(r['all_measurement_settings_documented_matching']for r in records),'casesWithLaterDifferentSettingRecords':sum(r['any_later_different_records']for r in records),'alignmentClinicallyConfirmed':0,'outcomeFilesRead':False,'notGasFittingAuthorization':True}
for n,v in [('context_alignment.json',records),('context_alignment_summary.json',summary)]:
 with(out/n).open('x')as f:json.dump(v,f,indent=2,default=str)
print(json.dumps(summary))
