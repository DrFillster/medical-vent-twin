#!/usr/bin/env python3
"""Observed input-event context only; no dose conversion or causal inference."""
import json,sys
from pathlib import Path
import duckdb
b=Path(sys.argv[1]);raw=Path(sys.argv[2]);out=b/'dev-similar-settings-v1';c=duckdb.connect();c.execute("set memory_limit='2GB'");c.execute('set threads=2')
obs=[r for r in json.loads((out/'raw_outcome_comparisons.json').read_text())if r.get('observed')];c.execute('create table selected(event_id varchar,elapsed_sec bigint)');c.executemany('insert into selected values (?,?)',[(r['event_id'],r['observed']['elapsed_sec'])for r in obs]);c.execute('create table e as select p.event_id,p.stay_id,p.transition_time,s.elapsed_sec from read_parquet(?) p join selected s using(event_id)',[str(b/'primary60_fit_manifest.parquet')])
c.execute("create table agents as select try_cast(itemid as bigint) itemid,label from read_csv_auto(?,all_varchar=true) where lower(label) similar to '.*(propofol|fentanyl|midazolam|dexmedetomidine|lorazepam|morphine|hydromorphone|ketamine|cisatracurium|rocuronium|vecuronium|succinylcholine|norepinephrine|epinephrine|vasopressin|phenylephrine|dobutamine|milrinone).*'",[str(Path('/Users/philipbernard/mimic-data/bootstrap/mimiciv-3.1/icu/d_items.csv.gz'))])
rows=c.execute("select e.event_id,e.transition_time,i.starttime,i.endtime,i.storetime,a.label,i.amount,i.amountuom,i.rate,i.rateuom,i.statusdescription from read_csv_auto(?) i join e on i.stay_id=e.stay_id join agents a on i.itemid=a.itemid where i.starttime<=e.transition_time+(e.elapsed_sec * interval '1 second') and i.endtime>=e.transition_time-interval '2 hours' order by e.event_id,i.starttime,i.storetime",[str(raw/'icu/inputevents.csv.gz')]).fetchall();cols=[x[0]for x in c.description];records=[]
for r in rows:
 x=dict(zip(cols,r));x['started_strictly_after_transition']=x['starttime']>x['transition_time'];x['known_by_cutoff_proxy']=x['storetime']is not None and x['storetime']<x['transition_time'];x['dose_recomputed']=False;records.append(x)
summary={'casesWithOutcomeInspected':len(obs),'inputEventRows':len(records),'casesWithRelevantInputEvents':len({x['event_id']for x in records}),'casesWithPostTransitionStarts':len({x['event_id']for x in records if x['started_strictly_after_transition']}),'scope':'selected agents in ICU inputevents only; no prescription/MAR equivalence, no administration-completeness claim','statusCaveat':'rewritten/canceled records retained; require status adjudication','causalInterpretationPermitted':False}
for name,value in [('medication_context_rows.json',records),('medication_context_summary.json',summary)]:
 with(out/name).open('x')as f:json.dump(value,f,indent=2,default=str)
print(json.dumps(summary))
