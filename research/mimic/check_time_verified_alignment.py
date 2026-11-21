#!/usr/bin/env python3
from pathlib import Path
import json,sys
b=Path(sys.argv[1]);out=b/'dev-time-verified-replay-v1';p={r['event_id']:r for r in json.loads((out/'packets.json').read_text())};r=json.loads((out/'context_alignment.json').read_text());assert len(r)==4
for x in r:
 assert p[x['event_id']]['input_time_gate_pass']
 assert len(x['checks'])==4*len(x['measurement_times'])
 assert not x['alignment_confirmed']
 for z in x['checks']:
  for source in ([z['latest_at_or_before_sample']]if z['latest_at_or_before_sample']else [])+z['later_different_setting_records']:
   assert source[0]<p[x['event_id']]['cutoff']and source[1]<p[x['event_id']]['cutoff']
  if z['latest_at_or_before_sample']:assert z['latest_at_or_before_sample'][0]<=z['measurement_time']
 assert x['all_measurement_settings_documented_matching']==all(z['matches_cutoff_setting']for z in x['checks'])
assert sum(x['all_measurement_settings_documented_matching']for x in r)==3
print('PASS four-case source/setting alignment contract; three all-match contexts and one missing PS-at-MV context; no clinical alignment claimed')
