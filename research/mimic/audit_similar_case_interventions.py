#!/usr/bin/env python3
"""Descriptive recorded-setting audit only; absence of chart changes is not stability."""
import json,sys
from pathlib import Path
import duckdb
b=Path(sys.argv[1]);out=b/'dev-similar-settings-v1';c=duckdb.connect();c.execute("set memory_limit='2GB'");c.execute('set threads=2')
m=json.loads((out/'manifest.json').read_text());ids=[eid for g in m['groups']for eid in g['ids']]
c.execute('create table selected(event_id varchar)');c.executemany('insert into selected values (?)',[(x,)for x in ids]);c.execute('create table e as select p.* from read_parquet(?) p join selected using(event_id)',[str(b/'primary60_fit_manifest.parquet')]);events=c.execute('select event_id,stay_id,transition_time,transition_pre_value,transition_post_value,pre_peep,pre_psv,pre_mode from e').fetchall()
obs={r['event_id']:r.get('observed')for r in json.loads((out/'raw_outcome_comparisons.json').read_text())}
items={223835:'fio2',220339:'peep',224701:'pressure_support',223849:'mode',229314:'mode_hamilton'};records=[]
for eid,stay,cut,pre,post,peep,ps,mode in events:
 elapsed=obs[eid]['elapsed_sec']if obs.get(eid)else 3600
 rows=c.execute("select itemid,charttime,storetime,value,valuenum,valueuom from read_parquet(?) where stay_id=? and itemid in (223835,220339,224701,223849,229314) and charttime>=? - interval '2 hours' and charttime<=? + (? * interval '1 second') order by charttime,storetime,itemid",[str(b/'vent_chart_events.parquet'),stay,cut,cut,elapsed]).fetchall()
 fields={};flags=[]
 for item,name in items.items():
  source=[r for r in rows if r[0]==item];strict=[r for r in source if r[1]<cut and r[2]is not None and r[2]<cut];at=[r for r in source if r[1]==cut];after=[r for r in source if r[1]>cut]
  expected={223835:post,220339:peep,224701:ps,223849:mode}.get(item)
  changes=[r for r in after if expected is not None and (r[4]if item not in [223849,229314]else r[3])!=expected]
  if changes:flags.append(name+'_differs_from_simulated_setting')
  fields[name]={'latest_strict_pre':strict[-1]if strict else None,'at_transition':at,'post_transition':after,'different_from_expected':changes,'expected_value':expected,'no_post_chart_does_not_confirm_stability':True}
 records.append({'event_id':eid,'window_sec':elapsed,'fields':fields,'flags':flags,'medication_changes_assessed':False,'causal_attribution_permitted':False})
summary={'cases':len(records),'withRecordedPostChangeSettingDifferences':sum(bool(r['flags'])for r in records),'withObservedGas':sum(bool(obs.get(x))for x in ids),'medicationsAudited':False,'noAbsenceOfChangeAssumption':True,'physiologicalChangesNotAttributedToFio2':True}
for name,value in [('intervention_history_audit.json',records),('intervention_history_summary.json',summary)]:
 with(out/name).open('x')as f:json.dump(value,f,indent=2,default=str)
print(json.dumps(summary));print('qualified_outcome_case_flags',[(r['flags'])for r in records if obs.get(r['event_id']) and r['event_id']in set(json.loads((b/'dev-qualified-prediction-v1/manifest.json').read_text())['qualifiedIds'])])
