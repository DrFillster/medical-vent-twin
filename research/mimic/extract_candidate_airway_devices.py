#!/usr/bin/env python3
"""Single raw stream pass; retain only candidate pre-change device evidence."""
from pathlib import Path
import json,sys,duckdb
b=Path(sys.argv[1]);o=b/'candidate-airway-devices-v1';o.mkdir(exist_ok=False);raw=b.parent/'raw/mimiciv/3.1/mimiciv-3.1/icu/chartevents.csv.gz';c=duckdb.connect();c.execute("SET threads=4");c.execute("SET memory_limit='2GB'");c.execute("SET temp_directory='/Users/philipbernard/mimic-data/tmp'")
c.execute('CREATE TABLE windows AS SELECT event_key,subject_id,stay_id,charttime cutoff FROM read_parquet(?) WHERE recorded_exposure_compatible',[str(b/'candidate-exposure-alignment-v1/assessment.parquet')])
items=[223836,223837,223838,224415,224829,224831,224832,225277,225278,227567,227568]
manifest={'status':'started','items':items,'source':str(raw),'sourceSize':raw.stat().st_size,'sourceMtimeNs':raw.stat().st_mtime_ns,'restriction':'exists candidate window; charttime/storetime < cutoff; 4h lookback; exposure-compatible events only','outcomesRead':False,'fittingPerformed':False}
(o/'manifest.json').write_text(json.dumps(manifest,indent=2));print('START raw device stream extraction',flush=True)
c.execute("COPY (SELECT v.subject_id,v.hadm_id,v.stay_id,v.charttime,v.storetime,v.itemid,v.value,v.valuenum,v.valueuom FROM read_csv_auto(?,header=true,sample_size=200000) v WHERE v.itemid IN ("+','.join(map(str,items))+") AND EXISTS(SELECT 1 FROM windows w WHERE w.subject_id=v.subject_id AND w.stay_id=v.stay_id AND v.charttime>=w.cutoff-INTERVAL '4 hours' AND v.charttime<w.cutoff AND v.storetime<w.cutoff)) TO ? (FORMAT PARQUET,COMPRESSION ZSTD)",[str(raw),str(o/'device_events.parquet')])
summary={'rows':c.execute('SELECT count(*) FROM read_parquet(?)',[str(o/'device_events.parquet')]).fetchone()[0],'candidateWindows':c.execute('SELECT count(*) FROM windows').fetchone()[0],'valueInventory':[{'itemid':x[0],'value':x[1],'rows':x[2]}for x in c.execute('SELECT itemid,value,count(*) FROM read_parquet(?) GROUP BY ALL ORDER BY itemid,count(*) DESC',[str(o/'device_events.parquet')]).fetchall()],'outcomesRead':False,'clinicalAirwayClassificationCompleted':False}
(o/'summary.json').write_text(json.dumps(summary,indent=2));manifest['status']='completed';(o/'manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps({'rows':summary['rows'],'candidateWindows':summary['candidateWindows'],'complete':True}),flush=True)
