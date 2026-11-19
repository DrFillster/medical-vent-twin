#!/usr/bin/env python3
from pathlib import Path
import duckdb, hashlib, json

DER=Path("/Users/philipbernard/mimic-data/derived")
H=DER/"preindex_peep_history_clean.parquet"
V=DER/"vent_chart_events.parquet"
T=DER/"vent_timing_flow_events.parquet"
OUT=DER/"controlled_recruitment_history_6.json"

con=duckdb.connect()
rows=con.execute(f"""
WITH e AS (
 select * from read_parquet('{H}')
 where fio2_stable and mode_stable=true and mode_before='P-CMV'
), x AS (
 select e.*,
   (select valuenum from read_parquet('{V}') z
    where z.stay_id=e.stay_id and z.itemid=224688
      and z.charttime between e.historical_transition_time-interval '2 hours'
                          and e.historical_transition_time
      and z.valuenum is not null
    order by z.charttime desc,z.storetime desc limit 1) rr_set,
   (select valuenum from read_parquet('{V}') z
    where z.stay_id=e.stay_id and z.itemid in (224702,227187,229663)
      and z.charttime between e.historical_transition_time-interval '2 hours'
                          and e.historical_transition_time
      and z.valuenum is not null
    order by z.charttime desc,z.storetime desc limit 1) pinsp,
   (select valuenum from read_parquet('{T}') z
    where z.stay_id=e.stay_id and z.itemid=224738
      and z.charttime between e.historical_transition_time-interval '2 hours'
                          and e.historical_transition_time
      and z.valuenum is not null
    order by z.charttime desc,z.storetime desc limit 1) ti
 from e
)
select * from x order by historical_transition_time
""").fetchdf()

out=[]
for _,r in rows.iterrows():
    raw=f"{int(r.stay_id)}|{r.historical_transition_time}"
    eid="RCR-"+hashlib.sha256(raw.encode()).hexdigest()[:12]
    def c(v):
        try:
            import pandas as pd
            if pd.isna(v): return None
        except Exception: pass
        if hasattr(v,"item"): return v.item()
        if hasattr(v,"isoformat"): return v.isoformat()
        return v
    out.append({
      "event_id":eid,
      "stay_id_local_only":int(r.stay_id),
      "historical_transition_time_local_only":c(r.historical_transition_time),
      "vent":{
        "fio2_percent":c(r.fio2_before_pct),
        "peep_before":c(r.historical_peep_before),
        "peep_after":c(r.historical_peep_after),
        "rr_set":c(r.rr_set),
        "pinsp":c(r.pinsp),
        "inspiratory_time_sec":c(r.ti),
      },
      "pre":{
        "ph":c(r.historical_pre_ph),
        "pco2":c(r.historical_pre_pco2),
        "po2":c(r.historical_pre_po2),
        "spo2":c(r.historical_pre_spo2),
        "vt_observed_ml":c(r.historical_pre_vt_observed),
        "minute_volume":c(r.historical_pre_minute_volume),
        "peak_pressure":c(r.historical_pre_peak_pressure),
        "plateau_pressure":c(r.historical_pre_plateau),
        "compliance":c(r.historical_pre_compliance),
      },
      "post":{
        "ph":c(r.historical_post_ph),
        "pco2":c(r.historical_post_pco2),
        "po2":c(r.historical_post_po2),
        "spo2":c(r.historical_post_spo2),
        "vt_observed_ml":c(r.historical_post_vt_observed),
        "minute_volume":c(r.historical_post_minute_volume),
        "peak_pressure":c(r.historical_post_peak_pressure),
        "plateau_pressure":c(r.historical_post_plateau),
        "compliance":c(r.historical_post_compliance),
      }
    })

json.dump(out,open(OUT,"w"),indent=2)
print("events",len(out))
for x in out:
    print(x["event_id"],x["vent"]["peep_before"],"->",x["vent"]["peep_after"],
          "VT",x["pre"]["vt_observed_ml"],"PaO2",x["pre"]["po2"],"->",x["post"]["po2"])
