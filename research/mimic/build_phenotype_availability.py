#!/usr/bin/env python3
"""Pre-change feature availability; no disease classification or outcome reads."""
from pathlib import Path
import json,hashlib,sys
b=Path(sys.argv[1]);out=b/'dev-phenotype-v1';out.mkdir(exist_ok=True)
m=json.loads((b/'dev-qualified-prediction-v1/manifest.json').read_text())
qualified=set(m['qualifiedIds']);excluded=set(m['excludedIds']);ids=qualified|excluded
raw=(b/'primary60_conservative_prefit.json').read_bytes();rows=[x for x in json.loads(raw) if x['event_id'] in ids]
assert len(rows)==19 and len({x['event_id'] for x in rows})==19
fields={'oxygenation_pao2':('targets','po2'),'oxygen_support_fio2':('vent','fio2_percent'),'oxygen_support_peep':('vent','peep'),'co2_paco2':('targets','pco2'),'ventilation_minute_volume':('targets','minute_volume'),'breath_size_vt':('targets','vt_observed_ml'),'breathing_rate':('targets','rr_total'),'acid_base_ph':('targets','ph'),'assistance_ps':('vent','psv')}
records=[]
for x in rows:
    features={name:{'value':x.get(section,{}).get(key),'status':'present_in_prefit' if x.get(section,{}).get(key) is not None else 'unavailable_in_prefit','source':f'primary60_conservative_prefit.json:{section}.{key}','time_quality':'requires_source_timestamp_review','measurement_quality':'not_independently_verified'} for name,(section,key) in fields.items()}
    for name in ['plateau_pressure','total_peep','compliance','resistance','effort_measurement','dyssynchrony','diagnosis_context','sedation_paralysis','bicarbonate','lactate','petco2']:
        features[name]={'value':None,'status':'not_extracted','time_quality':'unknown','measurement_quality':'unknown'}
    features['mode']={'value':x['hummod_mode'],'status':'present_in_prefit','source':'primary60_conservative_prefit.json:hummod_mode','time_quality':'requires_source_timestamp_review'}
    records.append({'event_id':x['event_id'],'qualification':'qualified' if x['event_id'] in qualified else 'failed','features':features,'disease_phenotype_assigned':False,'fitted_parameters_used_as_features':False})
summary={'version':'phenotype-availability-v1','developmentOnly':True,'outcomesRead':False,'inputSha256':hashlib.sha256(raw).hexdigest(),'counts':{'all':19,'qualified':10,'failed':9},'availability':{}}
for name in records[0]['features']:
    summary['availability'][name]={group:sum(r['features'][name]['value'] is not None for r in records if group=='all' or r['qualification']==group) for group in ['all','qualified','failed']}
for name,value in [('features.json',records),('availability.json',summary)]:
    with (out/name).open('x') as f:json.dump(value,f,indent=2);f.write('\n')
print(json.dumps(summary))
