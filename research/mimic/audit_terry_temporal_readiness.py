#!/usr/bin/env python3
"""Read identity/timing only; status-derived starts are provisional, not intubation."""
import json,sys,hashlib
from pathlib import Path
import duckdb

def audit(base):
    b=Path(base);c=duckdb.connect()
    raw=(b/'dev-qualified-prediction-v1/manifest.json').read_bytes()
    m=json.loads(raw);ids=m['qualifiedIds']+m['excludedIds']
    assert len(ids)==len(set(ids))==19
    c.execute('create table chosen(event_id varchar)')
    c.executemany('insert into chosen values (?)',[(x,) for x in ids])
    c.execute('create table events as select event_id,subject_id,stay_id,transition_time from read_parquet(?) join chosen using(event_id)',[str(b/'primary60_fit_manifest.parquet')])
    assert c.execute('select count(*) from events').fetchone()[0]==19
    c.execute("create table starts as select stay_id,min(starttime) as starttime from read_parquet(?) where ventilation_status='InvasiveVent' group by stay_id",[str(b/'mimic_ventilation_status.parquet')])
    rows=c.execute("select event_id,subject_id,stay_id,transition_time,starttime,case when starttime is null then 'unknown_start' when transition_time < starttime then 'before_status_start' when transition_time < starttime + interval '24 hours' then 'before_24h_completion' else 'at_or_after_24h_completion' end as timing_status from events left join starts using(stay_id)").fetchall()
    records=[dict(zip(['event_id','subject_id','stay_id','transition_time','status_start','timing_status'],r)) for r in rows]
    counts={k:sum(x['timing_status']==k for x in records) for k in ['unknown_start','before_status_start','before_24h_completion','at_or_after_24h_completion']}
    assert sum(counts.values())==19
    report={'developmentOnly':True,'outcomeValuesRead':False,'phenotypeAssigned':False,'eligibilityEstablished':False,'startSource':'earliest InvasiveVent interval in current ICU stay; NOT confirmed first invasive ventilator chart timestamp or hospital encounter start','manifestSha256':hashlib.sha256(raw).hexdigest(),'counts':counts,'limitations':['Earlier ventilation at another ICU/hospital not resolved','No age or total hospital ventilation duration eligibility applied','Published first invasive chart timestamp not yet reconstructed','No cluster model artifacts available for assignment']}
    out=b/'dev-phenotype-v1'
    for name,data in [('terry_temporal_readiness.json',report),('terry_temporal_records.json',records)]:
        with (out/name).open('x') as f:json.dump(data,f,indent=2,default=str);f.write('\n')
    print(json.dumps(report))
if __name__=='__main__':audit(sys.argv[1])
