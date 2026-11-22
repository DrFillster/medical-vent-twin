#!/usr/bin/env python3
"""Export baseline-only packets; no post-change measurements or prediction fitting."""
from pathlib import Path
import sys,json,duckdb,hashlib
b=Path(sys.argv[1]);o=b/'documented-airway-cohort-v1';dest=o/'baseline_only_packets_v2.jsonl';c=duckdb.connect();subjects=[json.loads(x)for x in(o/'legacy_reconciled_subject_partition.jsonl').read_text().splitlines()];packets=[]
for r in subjects:
 key=r['event_key'];measurements=c.execute('SELECT itemid,number_value,unit,charttime,text_value FROM read_parquet(?) WHERE event_key=? ORDER BY itemid',[str(b/'prechange-candidate-screen-v2/latest.parquet'),key]).fetchall()
 specimen=c.execute('SELECT specimen_id,charttime FROM read_parquet(?) WHERE event_key=? AND arterial AND no_conflicting_type AND ph AND co2 AND o2 ORDER BY charttime DESC,specimen_id LIMIT 1',[str(b/'prechange-candidate-screen-v2/lab_blocks.parquet'),key]).fetchone();assert specimen
 gas=c.execute('SELECT itemid,min(valuenum),min(valueuom),max(storetime) FROM read_parquet(?) WHERE subject_id=? AND hadm_id=? AND specimen_id=? AND charttime=? AND charttime<CAST(? AS TIMESTAMP) AND storetime<CAST(? AS TIMESTAMP) AND itemid IN(50820,50818,50821) GROUP BY itemid ORDER BY itemid',[str(b/'blood_gas_events.parquet'),r['subject_id'],r['hadm_id'],specimen[0],specimen[1],r['transition_time'],r['transition_time']]).fetchall();assert len(gas)==3
 packets.append({'event_key':key,'subject_id':r['subject_id'],'partition':r['partition'],'cutoff':r['transition_time'],'baseline_start':r['baseline_start'],'chartInputs':[{'itemid':i,'number':v,'unit':u,'charttime':str(t),'text':text}for i,v,u,t,text in measurements],'arterialSpecimen':{'specimen_id':specimen[0],'charttime':str(specimen[1]),'components':[{'itemid':i,'number':v,'unit':u,'storetime':str(st)}for i,v,u,st in gas]},'fitPerformed':False,'postChangeOutcomesIncluded':False,'status':'candidate inputs; QC and final protocol pending'})
with dest.open('x')as f:
 for p in packets:f.write(json.dumps(p)+'\n')
print(json.dumps({'baselinePackets':len(packets),'postChangeOutcomesIncluded':False,'sha256':hashlib.file_digest(dest.open('rb'),'sha256').hexdigest()}))
