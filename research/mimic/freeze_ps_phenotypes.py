#!/usr/bin/env python3
from pathlib import Path
import duckdb, json, glob, hashlib, subprocess

DER=Path("/Users/philipbernard/mimic-data/derived")
POOL=DER/"pilot_supported_mode_pool.parquet"
TARGETS=DER/"ps_etco2_effort_targets.json"
OUT=DER/"frozen_ps_phenotypes_6.json"

targets={x["event_id"]:x for x in json.load(open(TARGETS))}

effort={}
for p in sorted(glob.glob(str(DER/"ps_effort_fit_[0-7].json"))):
    for x in json.load(open(p)):
        if x.get("best") and x["best"]["objective"]<=1 and (x["best"]["model"]["asynchronyIndex"] or 0)==0:
            effort[x["event_id"]]=x["best"]

oxygen={}
for p in sorted(glob.glob(str(DER/"ps_oxygenation_fit_[0-5].json"))):
    for x in json.load(open(p)):
        if x.get("best"):
            oxygen[x["event_id"]]=x["best"]

repo="/Users/philipbernard/medical-vent-twin"
commit=subprocess.check_output(["git","-C",repo,"rev-parse","HEAD"],text=True).strip()

con=duckdb.connect()
rows=[]
for eid,best in effort.items():
    e=targets[eid]
    o=oxygen.get(eid)
    if not o:
        continue
    r=con.execute(f"""
      select itemid,prev_x,new_x,
             pre_mode,pre_fio2,pre_peep,pre_rr_set,pre_vt_set,pre_psv,pre_pinsp,
             pre_ph,pre_pco2,pre_po2,pre_hr,pre_map,pre_spo2,
             pre_abg_time,transition_time
      from read_parquet('{POOL}')
      where stay_id=? and transition_time=? and itemid=?
    """,[e["stay_id"],e["transition_time"],e["transition_itemid"]]).fetchone()
    if not r:
        continue
    (itemid,prev_x,new_x,pre_mode,pre_fio2,pre_peep,pre_rr_set,pre_vt_set,pre_psv,pre_pinsp,
     pre_ph,pre_pco2,pre_po2,pre_hr,pre_map,pre_spo2,pre_abg_time,transition_time)=r
    rows.append({
      "event_id":eid,
      "phenotype_schema_version":"0.3.0",
      "code_commit":commit,
      "freeze_rule":"pre-transition data only",
      "hummod_mode":"PS",
      "intervention":{
        "itemid":int(itemid),
        "pre_value":float(prev_x),
        "post_value":float(new_x)
      },
      "ventilator_pre":{
        "mode":pre_mode,
        "fio2_percent":float(pre_fio2),
        "peep":float(pre_peep),
        "psv":float(pre_psv)
      },
      "arterial_gas_initialization":{
        "ph_measured":float(pre_ph),
        "pco2_mmHg":float(pre_pco2),
        "po2_mmHg":float(pre_po2)
      },
      "effort":{
        "hennigs_drive_relative":float(best["drive"]),
        "muscle_transmission_relative":float(best["muscleTransmission"]),
        "stiffness_scale":float(best["stiffnessScale"]),
        "effort_fit_objective":float(best["objective"])
      },
      "dead_space":{
        "source":"measured_paco2_petco2_gradient",
        "fraction":float(e["measured_gradient"]),
        "quality":e["quality"]
      },
      "oxygenation":{
        "effective_ventilated_perfusion_fraction":float(o["perfusionFraction"]),
        "baseline_po2_fit_error_mmHg":float(o["po2Error"])
      },
      "baseline_observed":{
        "hr":float(pre_hr),
        "map":float(pre_map),
        "spo2":float(pre_spo2)
      }
    })

json.dump(rows,open(OUT,"w"),indent=2)
print("frozen",len(rows))
for x in rows:
    print(x["event_id"],x["intervention"]["itemid"],x["intervention"]["pre_value"],x["intervention"]["post_value"],
          "drive",x["effort"]["hennigs_drive_relative"],
          "muscle",x["effort"]["muscle_transmission_relative"],
          "dead",x["dead_space"]["fraction"],
          "ventperf",x["oxygenation"]["effective_ventilated_perfusion_fraction"])
