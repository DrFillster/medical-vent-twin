#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import sys,json,math,hashlib
b=Path(sys.argv[1]);o=b/'documented-airway-cohort-v1';ps=[json.loads(x)for x in(o/'baseline_only_packets_v2.jsonl').read_text().splitlines()];selected={r['event_key']:r for r in[json.loads(x)for x in(o/'legacy_reconciled_subject_partition.jsonl').read_text().splitlines()]};assert len(ps)==len(selected)==len({p['subject_id']for p in ps});required={223849,223835,220339,224701,224685,224687,224690}
for p in ps:
 assert p['partition']==selected[p['event_key']]['partition'];assert p['subject_id']==selected[p['event_key']]['subject_id'];cut=datetime.fromisoformat(p['cutoff']);assert not p['postChangeOutcomesIncluded']and not p['fitPerformed'];chart={x['itemid']:x for x in p['chartInputs']};assert required<=chart.keys();assert chart[223849]['text'] in {'PSV','CPAP/PSV','Pressure Support','PS'}
 for i in required:
  assert datetime.fromisoformat(chart[i]['charttime'])<cut
  if i!=223849:assert chart[i]['number']is not None and math.isfinite(chart[i]['number'])
 gas=p['arterialSpecimen'];assert datetime.fromisoformat(gas['charttime'])<cut;assert {x['itemid']for x in gas['components']}=={50820,50818,50821}
 for x in gas['components']:assert math.isfinite(x['number'])and x['number']>0 and datetime.fromisoformat(x['storetime'])<cut
print('PASS all baseline packets have required finite inputs, explicit mode text, valid partition identity and strictly pre-change gas availability; no fit/outcome payload')
print(json.dumps({'packets':len(ps),'partitions':{k:sum(p['partition']==k for p in ps)for k in ['reserved_test','comparator_training']},'baselineInputFileHash':hashlib.file_digest((o/'baseline_only_packets_v2.jsonl').open('rb'),'sha256').hexdigest()}))
