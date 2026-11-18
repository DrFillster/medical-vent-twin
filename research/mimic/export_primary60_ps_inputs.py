#!/usr/bin/env python3
from pathlib import Path
import duckdb, json

DER=Path("/Users/philipbernard/mimic-data/derived")
SRC=DER/"primary60_fit_manifest.parquet"
OUT=DER/"primary60_ps_fit_inputs.json"

con=duckdb.connect()
rows=con.execute(f"""
select
 event_id,
 transition_itemid,transition_pre_value,transition_post_value,
 pre_fio2,pre_peep,pre_psv,
 pre_rr_total,pre_rr_spontaneous,pre_vt_observed,pre_minute_volume,
 pre_peak_pressure,pre_plateau_pressure,pre_resistance,
 pre_compliance_documented,pre_compliance_derived,
 pre_ph,pre_pco2,pre_po2,
 pre_petco2,measured_paco2_petco2_fraction,etco2_deadspace_quality,
 effort_observable_count,
 has_preindex_peep_history,
 deadspace_source_plan,oxygenation_source_plan
from read_parquet('{SRC}')
where hummod_mode='PS' and mode_controller_ready
order by event_id
""").fetchall()

cols=[
"event_id","transition_itemid","transition_pre_value","transition_post_value",
"pre_fio2","pre_peep","pre_psv",
"pre_rr_total","pre_rr_spontaneous","pre_vt_observed","pre_minute_volume",
"pre_peak_pressure","pre_plateau_pressure","pre_resistance",
"pre_compliance_documented","pre_compliance_derived",
"pre_ph","pre_pco2","pre_po2",
"pre_petco2","measured_paco2_petco2_fraction","etco2_deadspace_quality",
"effort_observable_count","has_preindex_peep_history",
"deadspace_source_plan","oxygenation_source_plan"
]
out=[]
for row in rows:
    x=dict(zip(cols,row))
    for k,v in list(x.items()):
        if hasattr(v,"item"): x[k]=v.item()
    out.append(x)

json.dump(out,open(OUT,"w"),indent=2)
print("ps_inputs",len(out))
print("effort_counts",{
  n:sum(x["effort_observable_count"]==n for x in out)
  for n in sorted(set(x["effort_observable_count"] for x in out))
})
