'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {mechanicsParams}=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/controlled_recruitment_history_6.json';
const OUT='/Users/philipbernard/mimic-data/derived/recruitment_baseline_vpf_refined.json';

const VPF=[0.80,0.81,0.82,0.83,0.84,0.85,0.86,0.87,0.88,0.89,0.90];

const raw=JSON.parse(fs.readFileSync(INPUT,'utf8'));
const e=raw.find(x=>x.event_id==='RCR-3c238f0dd76b');
if(!e) throw new Error('event missing');
const stiffnessScale=1.5;

let best=null;
const candidates=[];
for(const vpf of VPF){
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
      initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
      patientMechanicsParams:mechanicsParams(stiffnessScale,1.0),
      patientVentilatedPerfusionFractionOverride:vpf,
      patientArterialGasInitialization:{
        po2MmHg:e.pre.po2,pco2MmHg:e.pre.pco2,pH:e.pre.ph,
      },
      dt:0.002,mechanicalWarmupSec:3,coupledEquilibrationSec:0,
    });
    s.initialize();
    const snap=s.runFor(10);
    const po2=snap.systemic.gasExchange.pao2MmHg;
    const err=po2-e.pre.po2;
    const row={vpf,po2,error:err,objective:Math.abs(err)};
    candidates.push(row);
    if(!best||row.objective<best.objective) best=row;
  }catch(err){
    candidates.push({vpf,errorMessage:String(err.message||err)});
  }
}
const out={event_id:e.event_id,targetPrePo2:e.pre.po2,best,candidates};
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out));
