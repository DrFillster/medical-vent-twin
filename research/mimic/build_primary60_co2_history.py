#!/usr/bin/env python3
from pathlib import Path
import duckdb, json

DER=Path("/Users/philipbernard/mimic-data/derived")
PREFIT=DER/"primary60_conservative_prefit.json"
MAN=DER/"primary60_fit_manifest.parquet"
ABG=DER/"arterial_blood_gases.parquet"
VENT=DER/"vent_chart_events.parquet"
TIMING=DER/"vent_timing_flow_events.parquet"
OUT=DER/"primary60_co2_history.json"

PS_MODES={'SPONT','CPAP/PSV','PSV/SBT','CPAP/PPS'}
PC_MODES={'P-CMV','PCV+Assist','PRES/AC'}
VC_MODES={'VOL/AC','CMV/ASSIST','CMV'}

con=duckdb.connect()
events=json.load(open(PREFIT))
out=[]

def scalar(q,args):
    r=con.execute(q,args).fetchone()
    return r[0] if r else None

for e in events:
    eid=e["event_id"]
    hadm,stay,t0=con.execute(f"""
      select hadm_id,stay_id,transition_time
      from read_parquet('{MAN}')
      where event_id=?
    """,[eid]).fetchone()

    abgs=con.execute(f"""
      select charttime,ph,pco2,po2
      from read_parquet('{ABG}')
      where hadm_id=?
        and charttime between ? - interval '6 hours' and ?
        and ph is not null and pco2 is not null and po2 is not null
      order by charttime
    """,[hadm,t0,t0]).fetchall()

    pts=[]
    for at,ph,pco2,po2 in abgs:
        mode=scalar(f"""
          select value from read_parquet('{VENT}')
          where stay_id=? and itemid in (223849,229314)
            and charttime between ? - interval '2 hours' and ?
            and value is not null
          order by charttime desc,storetime desc limit 1
        """,[stay,at,at])
        mapped=None
        if mode in PS_MODES: mapped="PS"
        elif mode in PC_MODES: mapped="PC_AC"
        elif mode in VC_MODES: mapped="VC_AC"
        if mapped!=e["hummod_mode"]:
            continue

        def ventval(itemids,window="2 hours"):
            ids="("+",".join(str(x) for x in itemids)+")"
            return scalar(f"""
              select valuenum from read_parquet('{VENT}')
              where stay_id=? and itemid in {ids}
                and charttime between ? - interval '{window}' and ?
                and valuenum is not null
              order by charttime desc,storetime desc limit 1
            """,[stay,at,at])

        fio2=ventval([223835])
        peep=ventval([220339])
        rrset=ventval([224688])
        vtset=ventval([224684])
        psv=ventval([224701])
        pinsp=ventval([224702,227187,229663])
        mv=ventval([224687],"30 minutes")
        rrtotal=ventval([224690],"30 minutes")
        vtobs=ventval([224685],"30 minutes")
        if mv is None and rrtotal is not None and vtobs is not None:
            mv=rrtotal*vtobs/1000.0

        flow=scalar(f"""
          select valuenum from read_parquet('{TIMING}')
          where stay_id=? and itemid=224691
            and charttime between ? - interval '2 hours' and ?
            and valuenum is not null
          order by charttime desc,storetime desc limit 1
        """,[stay,at,at])
        ti=scalar(f"""
          select valuenum from read_parquet('{TIMING}')
          where stay_id=? and itemid=224738
            and charttime between ? - interval '2 hours' and ?
            and valuenum is not null
          order by charttime desc,storetime desc limit 1
        """,[stay,at,at])
        ir=scalar(f"""
          select valuenum from read_parquet('{TIMING}')
          where stay_id=? and itemid=226873
            and charttime between ? - interval '2 hours' and ?
            and valuenum is not null
          order by charttime desc,storetime desc limit 1
        """,[stay,at,at])

        controller_ready=False
        if mapped=="PS":
            controller_ready=(fio2 is not None and peep is not None and psv is not None and mv is not None)
        elif mapped=="PC_AC":
            controller_ready=(fio2 is not None and peep is not None and rrset is not None and pinsp is not None and ti is not None and mv is not None)
        elif mapped=="VC_AC":
            controller_ready=(fio2 is not None and peep is not None and rrset is not None and vtset is not None and (flow is not None or ti is not None or ir is not None) and mv is not None)
        if not controller_ready:
            continue

        pts.append({
          "abg_time":at.isoformat(),
          "ph":float(ph),"pco2":float(pco2),"po2":float(po2),
          "mode":mapped,
          "vent":{
            "fio2_percent":float(fio2),"peep":float(peep),
            "rr_set":None if rrset is None else float(rrset),
            "vt_set_ml":None if vtset is None else float(vtset),
            "psv":None if psv is None else float(psv),
            "pinsp":None if pinsp is None else float(pinsp),
            "flow_l_min":None if flow is None else float(flow),
            "inspiratory_time_sec":None if ti is None else float(ti),
            "inspiratory_ratio":None if ir is None else float(ir),
            "minute_volume":float(mv),
            "rr_total":None if rrtotal is None else float(rrtotal),
            "vt_observed_ml":None if vtobs is None else float(vtobs)
          }
        })

    if len(pts)>=2:
        out.append({
          "event_id":eid,
          "hummod_mode":e["hummod_mode"],
          "prefit":e["prefit"],
          "points":pts
        })

json.dump(out,open(OUT,"w"),indent=2)
print("events_with_2plus_same_mode_points",len(out))
from collections import Counter
print("modes",Counter(x["hummod_mode"] for x in out))
print("point_counts",Counter(len(x["points"]) for x in out))
