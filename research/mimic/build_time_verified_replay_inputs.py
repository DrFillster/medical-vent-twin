#!/usr/bin/env python3
"""Development packets from available pre-cutoff records, never outcome targets."""
from pathlib import Path
import json,sys
import duckdb
b=Path(sys.argv[1]);out=b/'dev-time-verified-replay-v1';out.mkdir(exist_ok=False)
c=duckdb.connect();c.execute("set memory_limit='2GB'");c.execute('set threads=2')
m=json.loads((b/'dev-qualified-prediction-v1/manifest.json').read_text());ids=m['qualifiedIds']+m['excludedIds'];assert len(ids)==len(set(ids))==19
c.execute('create table selected(event_id varchar)');c.executemany('insert into selected values (?)',[(x,)for x in ids]);c.execute('create table e as select p.* from read_parquet(?) p join selected using(event_id)',[str(b/'primary60_fit_manifest.parquet')]);rows=c.execute('select * from e').fetchall();cols=[x[0]for x in c.description];events=[dict(zip(cols,r))for r in rows]
c.execute("create table chart as select e.event_id,v.* from e join read_parquet(?) v on v.stay_id=e.stay_id where v.charttime>=e.transition_time-interval '2 hours' and v.charttime<e.transition_time and v.storetime<e.transition_time",[str(b/'vent_chart_events.parquet')])
c.execute("create table abg as select e.event_id,e.transition_time,a.* from e join read_parquet(?) a on a.hadm_id=e.hadm_id where a.charttime>=e.transition_time-interval '4 hours' and a.charttime<e.transition_time and a.ph is not null and a.pco2 is not null and a.po2 is not null",[str(b/'arterial_blood_gases.parquet')])
c.execute("create table rawlab as select a.event_id,a.transition_time,v.* from abg a join read_parquet(?) v on v.hadm_id=a.hadm_id and v.specimen_id=a.specimen_id where v.itemid in (50820,50818,50821) and v.charttime<a.transition_time and v.storetime<a.transition_time",[str(b/'blood_gas_events.parquet')])
packets=[]
for e in events:
 reasons=[];settings={};sources={}
 for label,item in [('fio2_percent',223835),('peep',220339),('psv',224701),('mode',223849)]:
  candidates=c.execute('select charttime,storetime,valuenum,value,valueuom from chart where event_id=? and itemid=? order by charttime desc,storetime desc',[e['event_id'],item]).fetchall()
  top=candidates[0]if candidates else None;ties=[x for x in candidates if top and x[:2]==top[:2]]
  sources[label]=top
  if not top:reasons.append('missing_time_verified_'+label);continue
  if len(ties)>1:reasons.append('ambiguous_'+label);continue
  settings[label]=top[3]if label=='mode'else top[2]
 # Blood gas must have all components from the same specimen with matching values.
 specimens=c.execute('select specimen_id,charttime,ph,pco2,po2 from abg where event_id=? order by charttime desc,specimen_id desc',[e['event_id']]).fetchall();chosen=None
 for sp in specimens:
  raw=c.execute('select itemid,charttime,storetime,valuenum,valueuom from rawlab where event_id=? and specimen_id=? order by itemid,charttime,storetime',[e['event_id'],sp[0]]).fetchall()
  expected={50820:sp[2],50818:sp[3],50821:sp[4]}
  if all(len([x for x in raw if x[0]==item])==1 and next(x[3]for x in raw if x[0]==item)==val for item,val in expected.items()):chosen={'specimen_id':sp[0],'charttime':sp[1],'ph':sp[2],'pco2':sp[3],'po2':sp[4],'component_sources':raw};break
 if not chosen:reasons.append('no_unambiguous_available_complete_abg')
 if settings.get('mode')not in ['PSV','CPAP/PSV','Pressure Support','PS']:reasons.append('mode_not_confirmed_PS')
 if 'fio2_percent'in settings and not 21<=settings['fio2_percent']<=100:reasons.append('fio2_range')
 if 'psv'in settings and not isinstance(settings['psv'],(float,int)):reasons.append('ps_not_numeric')
 packet={'event_id':e['event_id'],'cutoff':e['transition_time'],'vent':settings,'setting_sources':sources,'targets':{k:chosen[k]for k in ['ph','pco2','po2']}if chosen else None,'abg_source':chosen,'input_time_gate_pass':not reasons,'failures':reasons,'new_prediction_ready':False,'prior_prefit_reuse_permitted':False,'clinical_state_assigned':False,'remaining':'effort/mechanics must be refit from verified measurements; time-alignment and clinical validity review'}
 packets.append(packet)
summary={'cases':len(packets),'inputTimeGatePass':sum(x['input_time_gate_pass']for x in packets),'failureCounts':{s:sum(s in x['failures']for x in packets)for s in sorted({s for x in packets for s in x['failures']})},'outcomeFilesRead':False,'oldPrefitReused':False,'clinicalStateAssigned':False}
for n,v in [('packets.json',packets),('summary.json',summary)]:
 with(out/n).open('x')as f:json.dump(v,f,indent=2,default=str)
print(json.dumps(summary));print('strict_mode_labels',sorted({str(x['vent'].get('mode'))for x in packets}))
