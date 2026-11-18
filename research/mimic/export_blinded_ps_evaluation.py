#!/usr/bin/env python3
from pathlib import Path
import duckdb, json

DER=Path("/Users/philipbernard/mimic-data/derived")
POOL=DER/"pilot_supported_mode_pool.parquet"
FROZEN=DER/"frozen_ps_phenotypes_6.json"
TARGETS=DER/"ps_etco2_effort_targets.json"
HORIZONS=DER/"ps_prediction_horizons_6.json"
OUTCOMES=DER/"ps_blinded_outcomes_6.json"

frozen=json.load(open(FROZEN))
targets={x["event_id"]:x for x in json.load(open(TARGETS))}
con=duckdb.connect()

horizons=[]
outcomes=[]
for x in frozen:
    e=targets[x["event_id"]]
    r=con.execute(f"""
      select post_abg_minutes,
             post_ph,post_pco2,post_po2,
             post_hr,post_map,post_spo2
      from read_parquet('{POOL}')
      where stay_id=? and transition_time=? and itemid=?
    """,[e["stay_id"],e["transition_time"],e["transition_itemid"]]).fetchone()
    if not r:
        continue
    post_min,post_ph,post_pco2,post_po2,post_hr,post_map,post_spo2=r
    horizons.append({
      "event_id":x["event_id"],
      "post_abg_minutes":float(post_min)
    })
    outcomes.append({
      "event_id":x["event_id"],
      "post_ph":float(post_ph),
      "post_pco2":float(post_pco2),
      "post_po2":float(post_po2),
      "post_hr":float(post_hr),
      "post_map":float(post_map),
      "post_spo2":float(post_spo2)
    })

json.dump(horizons,open(HORIZONS,"w"),indent=2)
json.dump(outcomes,open(OUTCOMES,"w"),indent=2)
print("horizons",len(horizons),[(x["event_id"],x["post_abg_minutes"]) for x in horizons])
print("outcomes_sealed",len(outcomes))
