#!/usr/bin/env python3
"""Synthetic records only; verify cutoff, unknown-start and overwrite protection."""
import json,tempfile,contextlib,io
from pathlib import Path
import duckdb
from audit_terry_temporal_readiness import audit
with tempfile.TemporaryDirectory() as tmp:
    b=Path(tmp);(b/'dev-qualified-prediction-v1').mkdir();(b/'dev-phenotype-v1').mkdir()
    ids=[str(i) for i in range(19)]
    (b/'dev-qualified-prediction-v1/manifest.json').write_text(json.dumps({'qualifiedIds':ids[:10],'excludedIds':ids[10:]}))
    c=duckdb.connect()
    c.execute('create table e(event_id varchar,subject_id bigint,stay_id bigint,transition_time timestamp)')
    for i in range(19):
        t='2020-01-02 00:00:00' if i<16 else ('2020-01-01 23:59:59' if i==16 else '2019-12-31 23:59:59')
        c.execute('insert into e values (?,?,?,?)',[str(i),i,i,t])
    c.execute('create table v(stay_id bigint,starttime timestamp,endtime timestamp,ventilation_status varchar)')
    for i in range(18):c.execute("insert into v values (?,'2020-01-01','2020-01-04','InvasiveVent')",[i])
    c.execute('copy e to ? (format parquet)',[str(b/'primary60_fit_manifest.parquet')])
    c.execute('copy v to ? (format parquet)',[str(b/'mimic_ventilation_status.parquet')])
    with contextlib.redirect_stdout(io.StringIO()):audit(b)
    r=json.loads((b/'dev-phenotype-v1/terry_temporal_readiness.json').read_text())
    assert r['counts']=={'unknown_start':1,'before_status_start':1,'before_24h_completion':1,'at_or_after_24h_completion':16}
    assert not r['outcomeValuesRead'] and not r['phenotypeAssigned'] and not r['eligibilityEstablished']
    try:audit(b)
    except FileExistsError:pass
    else:raise AssertionError('must not overwrite existing audit')
    m=b/'dev-qualified-prediction-v1/manifest.json';m.write_text(json.dumps({'qualifiedIds':['0']*10,'excludedIds':ids[10:]}))
    try:audit(b)
    except AssertionError:pass
    else:raise AssertionError('must reject duplicate event identities')
print('PASS: cutoff equality, one-second early, before start, unknown start, explicit limitations, overwrite protection, duplicate rejection')
