#!/usr/bin/env python3
from pathlib import Path
import duckdb, hashlib, json

DER=Path("/Users/philipbernard/mimic-data/derived")
H=DER/"preindex_peep_history_clean.parquet"
V=DER/"vent_chart_events.parquet"
OUT=DER/"spont_recruitment_history_7.json"

con=duckdb.connect()
rows=con.execute(f"""
WITH e AS (
 select * from read_parquet('{H}')
 where fio2_stable and mode_stable=true and mode_before='SPONT'
), x AS (
 select e.*,
   (select valuenum from read_parquet('{V}') z where z.stay_id=e.stay_id and z.itemid=224690 and z.charttime between e.historical_transition_time-interval '2 hours' and e.historical_transition_time and z.valuenum is not null order by z.charttime desc,z.storetime desc limit 1) rr_total,
   (select valuenum from read_parquet('{V}') z where z.stay_id=e.stay_id and z.itemid in (224685,224686) and z.charttime between e.historical_transition_time-interval '2 hours' and e.historical_transition_time and z.valuenum is not null order by z.charttime desc,z.storetime desc limit 1) vt_obs,
   (select valuenum from read_parquet('{V}') z where z.stay_id=e.stay_id and z.itemid=224687 and z.charttime between e.historical_transition_time-interval '2 hours' and e.historical_transition_time and z.valuenum is not null order by z.charttime desc,z.storetime desc limit 1) mv,
   (select valuenum from read_parquet('{V}') z where z.stay_id=e.stay_id and z.itemid=224701 and z.charttime between e.historical_transition_time-interval '2 hours' and e.historical_transition_time and z.valuenum is not null order by z.charttime desc,z.storetime desc limit 1) psv,
   (select valuenum from read_parquet('{V}') z where z.stay_id=e.stay_id and z.itemid=229661 and z.charttime between e.historical_transition_time-interval '2 hours' and e.historical_transition_time and z.valuenum is not null order by z.charttime desc,z.storetime desc limit 1) comp
 from e
), d AS (
 select *, row_number() over(partition by stay_id,historical_transition_time order by index_transition_time) rn
 from x
)
select * from d
where rn=1
  and rr_total is not null
  and vt_obs is not null
  and mv is not null
  and psv is not null
  and comp is not null
order by historical_transition_time
""").fetchdf()

out=[]
for _,r in rows.iterrows():
    raw=f"{int(r.stay_id)}|{r.historical_transition_time}"
    eid='SPR-'+hashlib.sha256(raw.encode()).hexdigest()[:12]
    def c(v):
        try:
            import pandas as pd
            if pd.isna(v): return None
        except Exception: pass
        if hasattr(v,'item'): return v.item()
        if hasattr(v,'isoformat'): return v.isoformat()
        return v
    out.append({
      'event_id':eid,
      'stay_id_local_only':int(r.stay_id),
      'transition_time_local_only':c(r.historical_transition_time),
      'vent':{
        'fio2_percent':c(r.fio2_before_pct),
        'peep_before':c(r.historical_peep_before),
        'peep_after':c(r.historical_peep_after),
        'psv':c(r.psv),
      },
      'pre':{
        'rr':c(r.rr_total),
        'vt_ml':c(r.vt_obs),
        'mv':c(r.mv),
        'compliance':c(r.comp),
        'ph':c(r.historical_pre_ph),
        'pco2':c(r.historical_pre_pco2),
        'po2':c(r.historical_pre_po2),
        'spo2':c(r.historical_pre_spo2),
      },
      'post':{
        'ph':c(r.historical_post_ph),
        'pco2':c(r.historical_post_pco2),
        'po2':c(r.historical_post_po2),
        'spo2':c(r.historical_post_spo2),
        'vt_ml':c(r.historical_post_vt_observed),
        'mv':c(r.historical_post_minute_volume),
      }
    })
json.dump(out,open(OUT,'w'),indent=2)
print('events',len(out))
for x in out:
    print(x['event_id'],'PEEP',x['vent']['peep_before'],'->',x['vent']['peep_after'],
          'PS',x['vent']['psv'],'RR',x['pre']['rr'],'VT',x['pre']['vt_ml'],
          'MV',x['pre']['mv'],'C',x['pre']['compliance'],
          'PaO2',x['pre']['po2'],'->',x['post']['po2'])
