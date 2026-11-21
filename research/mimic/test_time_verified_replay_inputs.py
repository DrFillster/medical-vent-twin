#!/usr/bin/env python3
import tempfile,json,subprocess,sys
from pathlib import Path
import duckdb
with tempfile.TemporaryDirectory()as temp:
 b=Path(temp);(b/'dev-qualified-prediction-v1').mkdir();ids=[str(i)for i in range(19)];(b/'dev-qualified-prediction-v1/manifest.json').write_text(json.dumps({'qualifiedIds':ids[:10],'excludedIds':ids[10:]}));c=duckdb.connect()
 c.execute('create table e(event_id varchar,hadm_id bigint,stay_id bigint,transition_time timestamp)');c.execute('create table v(hadm_id bigint,stay_id bigint,itemid bigint,charttime timestamp,storetime timestamp,valuenum double,value varchar,valueuom varchar)');c.execute('create table a(hadm_id bigint,specimen_id bigint,charttime timestamp,ph double,pco2 double,po2 double)');c.execute('create table l(hadm_id bigint,specimen_id bigint,itemid bigint,charttime timestamp,storetime timestamp,valuenum double,valueuom varchar)')
 for i in range(19):
  c.execute("insert into e values (?,?,?,'2020-01-01 12:00:00')",[str(i),i,i])
  for item,val,text in [(223835,40,'40'),(220339,5,'5'),(224701,10,'10'),(223849,None,'CPAP/PSV')]:
   if i==1 and item==223849:continue
   c.execute("insert into v values (?,?,?,'2020-01-01 11:00:00','2020-01-01 11:10:00',?,?,null)",[i,i,item,val,text])
  # A late-stored pre-cutoff chart entry must not replace the earlier value.
  c.execute("insert into v values (?,?,223835,'2020-01-01 11:59:00','2020-01-01 12:01:00',99,'99',null)",[i,i])
  c.execute("insert into a values (?,?,'2020-01-01 11:00:00',7.4,40,80)",[i,i])
  for item,val in [(50820,7.4),(50818,40),(50821,80)]:
   store='2020-01-01 12:01:00'if i==2 else '2020-01-01 11:30:00';c.execute("insert into l values (?,?,?,'2020-01-01 11:00:00',?,?,null)",[i,i,item,store,val])
 for table,name in [('e','primary60_fit_manifest.parquet'),('v','vent_chart_events.parquet'),('a','arterial_blood_gases.parquet'),('l','blood_gas_events.parquet')]:c.execute('copy '+table+' to ? (format parquet)',[str(b/name)])
 result=subprocess.run([sys.executable,str(Path(__file__).with_name('build_time_verified_replay_inputs.py')),str(b)],capture_output=True,text=True);assert result.returncode==0,result.stderr
 p={x['event_id']:x for x in json.loads((b/'dev-time-verified-replay-v1/packets.json').read_text())};assert p['0']['input_time_gate_pass'];assert p['0']['vent']['fio2_percent']==40;assert not p['1']['input_time_gate_pass'];assert not p['2']['input_time_gate_pass'];assert p['2']['targets']is None;assert sum(x['input_time_gate_pass']for x in p.values())==17
 assert all(not x['prior_prefit_reuse_permitted']and not x['new_prediction_ready']for x in p.values())
 print('PASS strict setting availability, missing-mode exclusion, delayed lab exclusion, no old-prefit reuse')
