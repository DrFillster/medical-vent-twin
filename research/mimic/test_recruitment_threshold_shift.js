'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {mechanicsParams}=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/controlled_recruitment_history_6.json';
const OUT='/Users/philipbernard/mimic-data/derived/recruitment_threshold_smoke.json';
const SHIFTS=[-8,-6,-4,-2,0,2];
const Q=[0.20,0.30,0.40];

function clone(x){return JSON.parse(JSON.stringify(x));}

function params(stiffnessScale,q,shift){
  const p=clone(mechanicsParams(stiffnessScale,1.0));
  const non=1-q;
  for(const c of p.compartments){
    if(c.id==='recruitable'){
      c.perfusionFraction=q;
      c.recruitment.P_open=22+shift;
      c.recruitment.P_close=12+shift;
    }
    if(c.id==='normal') c.perfusionFraction=non*(0.55/0.70);
    if(c.id==='consolidated') c.perfusionFraction=non*(0.15/0.70);
  }
  return p;
}

const e=JSON.parse(fs.readFileSync(INPUT,'utf8')).find(x=>x.event_id==='RCR-3c238f0dd76b');
if(!e) throw new Error('event missing');
const stiffnessScale=2.0;

const rows=[];
for(const q of Q){
  for(const shift of SHIFTS){
    try{
      const s=createBerlinLiveHumModSession({
        caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
        ventilation:{
          mode:'PC_AC',
          fio2:e.vent.fio2_percent/100,
          peep:e.vent.peep_before,
          rr:e.vent.rr_set,
          pinspCmH2O:e.vent.pinsp,
          inspiratoryTimeSec:e.vent.inspiratory_time_sec,
          inspiratoryPauseSec:0,
        },
        initialRecruitmentState:{normal:1,recruitable:1,consolidated:0},
        patientMechanicsParams:params(stiffnessScale,q,shift),
        patientArterialGasInitialization:{
          po2MmHg:e.pre.po2,pco2MmHg:e.pre.pco2,pH:e.pre.ph,
        },
        dt:0.002,
        mechanicalWarmupSec:12.5,
        coupledEquilibrationSec:0,
      });
      s.initialize();
      const x=s.runFor(10);
      const b=x.pulmonary.measurements.lastValidDeliveredBreath;
      rows.push({
        q,shift,
        po2:x.systemic.gasExchange.pao2MmHg,
        vpf:x.systemic.gasExchange.ventilatedPerfusionFraction,
        vtMl:b&&b.VtInspired*1000,
      });
    }catch(err){
      rows.push({q,shift,error:String(err.message||err)});
    }
  }
}
fs.writeFileSync(OUT,JSON.stringify(rows,null,2)+'\n');
for(const r of rows){
  console.log(JSON.stringify(r));
}
