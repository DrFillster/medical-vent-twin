'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { mechanicsParams }=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/primary60_co2_history.json';
const OUT='/Users/philipbernard/mimic-data/derived/primary60_joint_co2_fit_2.json';

const DEAD=[0.05,0.10,0.20,0.30,0.40,0.50,0.60,0.70,0.80];
const VCO2=[4,6,8,10,12,14];

function ventFor(p){
  const v=p.vent;
  if(p.mode==='PS'){
    return {mode:'PS',fio2:v.fio2_percent/100,peep:v.peep,rr:2,
      pressureSupportCmH2O:v.psv};
  }
  if(p.mode==='PC_AC'){
    return {mode:'PC_AC',fio2:v.fio2_percent/100,peep:v.peep,rr:v.rr_set,
      pinspCmH2O:v.pinsp,inspiratoryTimeSec:v.inspiratory_time_sec,
      inspiratoryPauseSec:0};
  }
  if(p.mode==='VC_AC'){
    let flow=v.flow_l_min!=null?v.flow_l_min/60:null;
    if(flow==null&&v.inspiratory_time_sec!=null)
      flow=(v.vt_set_ml/1000)/v.inspiratory_time_sec;
    if(flow==null&&v.inspiratory_ratio!=null){
      const cycle=60/v.rr_set;
      const ti=cycle*(v.inspiratory_ratio/(1+v.inspiratory_ratio));
      flow=(v.vt_set_ml/1000)/ti;
    }
    return {mode:'VC_AC',fio2:v.fio2_percent/100,peep:v.peep,rr:v.rr_set,
      vtL:v.vt_set_ml/1000,inspiratoryFlowLps:flow,inspiratoryPauseSec:0};
  }
  throw new Error('unsupported mode');
}

function runPoint(event,p,dead,vco2){
  const opts={
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:ventFor(p),
    initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
    patientMechanicsParams:mechanicsParams(
      event.prefit.stiffness_scale,event.prefit.resistance_scale),
    patientDeadSpaceFractionOfTidalVolume:dead,
    patientTissueCo2ProductionMmolPerMin:vco2,
    patientArterialGasInitialization:{
      po2MmHg:p.po2,pco2MmHg:p.pco2,pH:p.ph
    },
    dt:0.010,mechanicalWarmupSec:3,coupledEquilibrationSec:0,
    physicianValidationCandidate:false
  };
  if(event.hummod_mode==='PS'){
    opts.patientStateProfile='awake_cooperative';
    opts.patientDriveRelativeOverride=event.prefit.drive;
    opts.patientMuscleTransmissionOverride=event.prefit.muscle_transmission;
  }
  const s=createBerlinLiveHumModSession(opts);
  s.initialize();
  const snap=s.runFor(20);
  return {
    targetPco2:p.pco2,
    finalPco2:snap.systemic.gasExchange.paco2MmHg,
    error:snap.systemic.gasExchange.paco2MmHg-p.pco2
  };
}

const events=JSON.parse(fs.readFileSync(INPUT,'utf8'));
const results=[];

for(const e of events){
  let best=null;
  const candidates=[];
  for(const dead of DEAD){
    for(const vco2 of VCO2){
      try{
        const points=e.points.map(p=>runPoint(e,p,dead,vco2));
        const objective=points.reduce((s,p)=>
          s+Math.pow(p.error/Math.max(5,0.10*p.targetPco2),2),0)/points.length;
        const row={deadSpaceFraction:dead,tissueCo2ProductionMmolPerMin:vco2,
          objective,points};
        candidates.push(row);
        if(!best||objective<best.objective) best=row;
      }catch(err){
        candidates.push({deadSpaceFraction:dead,
          tissueCo2ProductionMmolPerMin:vco2,error:String(err.message||err)});
      }
    }
  }
  const row={
    event_id:e.event_id,mode:e.hummod_mode,nPoints:e.points.length,
    best,candidates,
    deadSpaceBoundaryHit:best&&(best.deadSpaceFraction===DEAD[0]||
      best.deadSpaceFraction===DEAD[DEAD.length-1]),
    co2BoundaryHit:best&&(best.tissueCo2ProductionMmolPerMin===VCO2[0]||
      best.tissueCo2ProductionMmolPerMin===VCO2[VCO2.length-1])
  };
  results.push(row);
  console.log(JSON.stringify({
    event_id:e.event_id,mode:e.hummod_mode,
    dead:best&&best.deadSpaceFraction,
    vco2:best&&best.tissueCo2ProductionMmolPerMin,
    objective:best&&best.objective,
    errors:best&&best.points.map(x=>x.error),
    deadBoundary:row.deadSpaceBoundaryHit,
    co2Boundary:row.co2BoundaryHit
  }));
}
fs.writeFileSync(OUT,JSON.stringify(results,null,2)+'\n');
