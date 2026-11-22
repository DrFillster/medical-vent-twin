#!/usr/bin/env python3
"""Conservative documentary exposure compatibility; no outcome access or fitting."""
from pathlib import Path
import json,sys,duckdb,hashlib
b=Path(sys.argv[1]);o=b/'candidate-exposure-alignment-v1';o.mkdir(exist_ok=False);c=duckdb.connect();c.execute("SET threads=4");c.execute("SET memory_limit='2GB'")
c.execute('CREATE TABLE e AS SELECT * FROM read_parquet(?)',[str(b/'prechange-candidate-screen-v2/input_candidates.parquet')])
c.execute("""CREATE TABLE v AS SELECT e.event_key,v.itemid,v.charttime,v.storetime,
CASE WHEN v.itemid=223849 THEN v.value WHEN v.itemid=223835 AND v.valuenum BETWEEN .21 AND 1 THEN cast(v.valuenum*100 AS varchar) ELSE cast(v.valuenum AS varchar) END val
FROM e JOIN read_parquet(?) v ON v.subject_id=e.subject_id AND v.stay_id=e.stay_id
AND v.charttime>=e.charttime-INTERVAL '6 hours' AND v.charttime<e.charttime AND v.storetime<e.charttime
WHERE v.itemid IN(223849,223835,220339,224701)""",[str(b/'vent_chart_events.parquet')])
c.execute('CREATE TABLE blocks AS SELECT event_key,itemid,charttime,count(distinct val)=1 AND count(val)=count(*) valid,min(val) val FROM v GROUP BY ALL')
c.execute('CREATE TABLE cutoff AS SELECT * FROM blocks QUALIFY row_number() OVER(PARTITION BY event_key,itemid ORDER BY charttime DESC)=1')
c.execute("""CREATE TABLE measurements AS SELECT l.event_key,cast(l.itemid AS varchar) measurement,l.charttime sample_time FROM read_parquet(?) l JOIN e USING(event_key) WHERE l.itemid IN(224685,224687,224690)
UNION ALL SELECT l.event_key,'gas',max(l.charttime) FROM read_parquet(?) l JOIN e USING(event_key) WHERE arterial AND no_conflicting_type AND ph AND co2 AND o2 GROUP BY l.event_key""",[str(b/'prechange-candidate-screen-v2/latest.parquet'),str(b/'prechange-candidate-screen-v2/lab_blocks.parquet')])
c.execute("""CREATE TABLE checks AS SELECT m.*,t.itemid,t.val expected,
a.charttime earlier_setting_time,a.valid earlier_valid,a.val earlier_value,
coalesce(a.valid AND t.valid AND a.val=t.val,false) matches,
EXISTS(SELECT 1 FROM blocks x WHERE x.event_key=m.event_key AND x.itemid=t.itemid AND x.charttime>=m.sample_time AND (NOT x.valid OR x.val<>t.val)) later_conflict
FROM measurements m JOIN cutoff t USING(event_key)
LEFT JOIN LATERAL (SELECT * FROM blocks x WHERE x.event_key=m.event_key AND x.itemid=t.itemid AND x.charttime<m.sample_time ORDER BY charttime DESC LIMIT 1) a ON true""")
c.execute("""CREATE TABLE airway AS SELECT e.event_key,a.charttime,a.storetime,a.value,
count(distinct a.value) OVER(PARTITION BY e.event_key,a.charttime) distinct_values,
count(a.value) OVER(PARTITION BY e.event_key,a.charttime)=count(*) OVER(PARTITION BY e.event_key,a.charttime) complete,
row_number() OVER(PARTITION BY e.event_key ORDER BY a.charttime DESC,a.storetime DESC) rank
FROM e JOIN read_parquet(?) a ON a.subject_id=e.subject_id AND a.stay_id=e.stay_id
AND a.charttime>=e.charttime-INTERVAL '4 hours' AND a.charttime<e.charttime AND a.storetime<e.charttime
QUALIFY rank=1""",[str(b/'airway_type_events.parquet')])
c.execute("""CREATE TABLE assessment AS SELECT e.*,
coalesce(a.distinct_values=1 AND a.complete AND a.value IN('Oral','Nasotracheal'),false) documented_tube_route,
a.value airway_value,a.charttime airway_time,
coalesce(k.n=16 AND k.all_match AND NOT k.conflict,false) recorded_exposure_compatible
FROM e LEFT JOIN airway a USING(event_key)
LEFT JOIN (SELECT event_key,count(*) n,bool_and(matches) all_match,bool_or(later_conflict) conflict FROM checks GROUP BY event_key) k USING(event_key)""")
for t in ['checks','airway','assessment']:c.execute('COPY '+t+' TO ? (FORMAT PARQUET,COMPRESSION ZSTD)',[str(o/(t+'.parquet'))])
r={'inputEvents':c.execute('SELECT count(*) FROM e').fetchone()[0],'documentedTubeRouteEvents':c.execute('SELECT count(*) FROM assessment WHERE documented_tube_route').fetchone()[0],'recordedExposureCompatibleEvents':c.execute('SELECT count(*) FROM assessment WHERE recorded_exposure_compatible').fetchone()[0],'bothEvents':c.execute('SELECT count(*) FROM assessment WHERE documented_tube_route AND recorded_exposure_compatible').fetchone()[0],'bothSubjects':c.execute('SELECT count(distinct subject_id) FROM assessment WHERE documented_tube_route AND recorded_exposure_compatible').fetchone()[0],'positiveRouteNotExhaustive':True,'clinicalStabilityEstablished':False,'invasiveEligibilityFinallyAdjudicated':False,'completePriorUseEstablished':False,'outcomesRead':False,'fittingPerformed':False,'rules':'4h available airway label; each gas/mechanical sample requires strictly earlier matching setting and no documented differing/invalid setting thereafter; equal-time-only support fails; gas chosen latest available complete specimen, not best aligned','sourceHashes':{n:hashlib.file_digest((b/n).open('rb'),'sha256').hexdigest()for n in ['prechange-candidate-screen-v2/input_candidates.parquet','prechange-candidate-screen-v2/latest.parquet','prechange-candidate-screen-v2/lab_blocks.parquet','vent_chart_events.parquet','airway_type_events.parquet']}}
(o/'summary.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))
