#!/usr/bin/env python3
"""Inventory existing fit assumptions; never infer clinical diagnoses."""
import json,sys,hashlib
from pathlib import Path

def build(base):
 b=Path(base);m=json.loads((b/'dev-qualified-prediction-v1/manifest.json').read_text());qualified=set(m['qualifiedIds']);ids=qualified|set(m['excludedIds']);assert len(ids)==19
 raw=(b/'primary60_conservative_prefit.json').read_bytes();prefit={x['event_id']:x for x in json.loads(raw)}
 decisions={x['event_id']:x for x in json.loads((b/'dev-cohort-perfusion-v1/summary.json').read_text())['decisions']}
 parent=[json.loads(x) for x in (b/'dev-batch-baseline-v1/results.jsonl').read_text().splitlines() if x]
 records=[]
 for eid in sorted(ids):
  e=prefit[eid];p=e['prefit'];old=next(x for x in parent if x['event_id']==eid and x['condition']=='candidate_latent_sid');d=decisions[eid]
  records.append({'event_id':eid,'qualification':'qualified' if eid in qualified else 'failed','documented_diseases':[],'disease_evidence_status':'not_extracted_or_reviewed','phenotype_label':None,'measured_targets':e['targets'],'measurement_source':'primary60_conservative_prefit.json:targets','individual_measurement_times_verified':False,'configured_reference_case':'berlin-moderate-moderate-aspiration','reference_case_is_patient_diagnosis':False,'nominal_patient_profile':'awake_cooperative','profile_is_verified_clinical_state':False,'fixed_recruitment_state':{'normal':1,'recruitable':0.35,'consolidated':0},'fitted_mechanics_and_effort':{k:p[k] for k in ['stiffness_scale','resistance_scale','drive','muscle_transmission']},'baseline_gas_fit_parameters':old['pars'],'refinement_decision':d,'fitted_parameters_establish_diagnosis':False,'required_reviews':['timestamped clinical evidence','measurement chart and availability timestamps','reference-case dependency','recruitment assumptions','effort and sedation evidence','parameter identifiability']})
 assert len(records)==19 and len({r['event_id'] for r in records})==19
 assert sum(r['qualification']=='qualified' for r in records)==10
 assert all(not r['documented_diseases'] and not r['reference_case_is_patient_diagnosis'] and not r['profile_is_verified_clinical_state'] for r in records)
 report={'cases':19,'qualified':10,'failed':9,'clinical_diseases_assigned':0,'timestamp_verified_records':0,'common_reference_case':19,'common_nominal_awake_profile':19,'common_recruitment_initialization':19,'inputSha256':hashlib.sha256(raw).hexdigest(),'outcomeValuesRead':False,'physiologyChanged':False}
 out=b/'dev-disease-evidence-v1';out.mkdir(exist_ok=True)
 for name,value in [('records.json',records),('audit.json',report)]:
  with (out/name).open('x') as f:json.dump(value,f,indent=2);f.write('\n')
 print(json.dumps(report))
if __name__=='__main__':build(sys.argv[1])
