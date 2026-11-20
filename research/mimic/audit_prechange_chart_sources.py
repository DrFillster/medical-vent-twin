#!/usr/bin/env python3
"""Development-only source-time audit; no post-change rows or disease inference."""
import json,sys
from pathlib import Path
import duckdb
MAP={'pre_hr':[220045],'pre_map':[220052],'pre_spo2':[220277],'pre_vt_observed':[224685],'pre_minute_volume':[224687],'pre_rr_spontaneous':[224689],'pre_rr_total':[224690],'pre_peak_pressure':[224695],'pre_plateau_pressure':[224696],'pre_mean_airway_pressure':[224697],'pre_total_peep':[224700],'pre_resistance':[220283,229664,229665],'pre_compliance_documented':[229661]}
def audit(base):
 b=Path(base);c=duckdb.connect();c.execute("set memory_limit='2GB'");c.execute('set threads=2')
 m=json.loads((b/'dev-qualified-prediction-v1/manifest.json').read_text());ids=m['qualifiedIds']+m['excludedIds'];assert len(ids)==len(set(ids))==19
 c.execute('create table chosen(event_id varchar)');c.executemany('insert into chosen values (?)',[(x,)for x in ids])
 c.execute('create table e as select p.* from read_parquet(?) p join chosen using(event_id)',[str(b/'primary60_fit_manifest.parquet')])
 c.execute("create table source_rows as select e.event_id,e.transition_time,v.itemid,v.charttime,v.storetime,v.valuenum,v.valueuom from read_parquet(?) v join e on v.stay_id=e.stay_id where v.charttime >= e.transition_time-interval '2 hours' and v.charttime < e.transition_time and v.valuenum is not null",[str(b/'vent_chart_events.parquet')])
 records=[]
 rows=c.execute('select * from e').fetchall();cols=[x[0]for x in c.description]
 for row in rows:
  e=dict(zip(cols,row))
  for field,itemids in MAP.items():
   options=c.execute('select itemid,charttime,storetime,valuenum,valueuom from source_rows where event_id=? and itemid in ('+','.join('?'for _ in itemids)+') order by charttime desc,storetime desc',[e['event_id'],*itemids]).fetchall()
   matching=[x for x in options if x[3]==e[field]] if e[field] is not None else []
   available=[x for x in matching if x[2] is not None and x[2]<e['transition_time']]
   status='missing_manifest_value' if e[field] is None else ('matching_pre_cutoff_record' if available else ('matching_but_late_or_unknown_storetime' if matching else 'no_strict_pre_cutoff_match'))
   # A value match is a candidate source, not proof of exact original extraction identity.
   records.append({'event_id':e['event_id'],'field':field,'manifest_value':e[field],'status':status,'candidate_source':available[0] if available else (matching[0] if matching else None),'source_identity_unique':len(available)==1,'exact_original_source_verified':False,'matching_pre_cutoff_candidates':len(available),'diagnosis_inferred':False})
 summary={'events':19,'fields_per_event':len(MAP),'records':len(records),'counts':{s:sum(x['status']==s for x in records)for s in sorted({x['status']for x in records})},'strictCutoff':True,'postChangeRowsRead':False,'exactOriginalSourcesEstablished':False,'limitations':['same-valued earlier measurements may not be original source','excludes exact-transition chart/store times to avoid ordering ambiguity','ventilator setting and lab provenance not yet audited','item mappings inherited from existing extractor; dictionary verification still required']}
 assert len(records)==19*len(MAP)
 out=b/'dev-disease-evidence-v1'
 for name,value in [('chart_source_records.json',records),('chart_source_audit.json',summary)]:
  with(out/name).open('x')as f:json.dump(value,f,indent=2,default=str)
 print(json.dumps(summary))
if __name__=='__main__':audit(sys.argv[1])
