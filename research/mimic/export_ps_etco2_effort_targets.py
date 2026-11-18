#!/usr/bin/env python3
from pathlib import Path
import duckdb, hashlib, json

DER=Path("/Users/philipbernard/mimic-data/derived")
P=DER/"phenotype_inputs_with_etco2.parquet"
OUT=DER/"ps_etco2_effort_targets.json"

con=duckdb.connect()
rows=con.execute(f"""
select stay_id,transition_time,transition_itemid,
       etco2_deadspace_quality,measured_paco2_petco2_fraction,
       pre_fio2,pre_peep,pre_psv,
       pre_rr_total,pre_rr_spontaneous,pre_vt_observed,pre_minute_volume,
       pre_compliance_documented,pre_resistance,
       pre_ph,pre_pco2,pre_po2
from read_parquet('{P}')
where hummod_mode='PS'
  and etco2_deadspace_quality in ('A','B')
order by transition_time
""").fetchall()

names=[
'stay_id','transition_time','transition_itemid','quality','measured_gradient',
'fio2','peep','psv','rr_total','rr_spont','vt_ml','mv',
'compliance_doc','resistance','ph','pco2','po2'
]
out=[]
for row in rows:
    x=dict(zip(names,row))
    raw=f"{int(x['stay_id'])}|{x['transition_time']}|{int(x['transition_itemid'])}"
    x['event_id']='FIT-'+hashlib.sha256(raw.encode()).hexdigest()[:12]
    for k,v in list(x.items()):
        if hasattr(v,'item'): x[k]=v.item()
        elif hasattr(v,'isoformat'): x[k]=v.isoformat()
    out.append(x)
json.dump(out,open(OUT,'w'),indent=2)
print('events',len(out))
for x in out:
    print(x['event_id'],x['quality'],x['measured_gradient'],x['rr_total'],x['vt_ml'],x['mv'],x['compliance_doc'])
