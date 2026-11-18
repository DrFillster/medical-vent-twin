'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { mechanicsParams }=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/primary60_conservative_prefit.json';
const OUT='/Users/philipbernard/mimic-data/derived/primary60_deadspace_smoke_5.json';
const FRACTIONS=[0.05,0.10,0.20,0.30,0.40,0.50,0.60,0.70,0.80];

function ventFor(e){
  const v=e.vent;
  if(e.hummod_mode==='PS'){
    return {
      mode:'PS',fio2:v.fio2_percent/100,peep:v.peep,rr:2,
      pressureSupportCmH2O:v.psv
    };
  }
  if(e.hummod_mode==='PC_AC'){
    return {
      mode:'PC_AC',fio2:v.fio2_percent/100,peep:v.peep,rr:v.rr_set,
      pinspCmH2O:v.pinsp,inspiratoryTimeSec:v.inspiratory_time_sec,
      inspiratoryPauseSec:0
    };
  }
  if(e.hummod_mode==='VC_AC'){
    let flow=v.flow_l_min!=null?v.flow_l_min/60:null;
    if(flow==null && v.inspiratory_time_sec!=null){
      flow=(v.vt_set_ml/1000)/v.inspiratory_time_sec;
    }
    if(flow==null && v.inspiratory_ratio!=null && v.rr_set!=null){
      const cycle=60/v.rr_set;
      const ti=cycle*(v.inspiratory_ratio/(1+v.inspiratory_ratio));
      flow=(v.vt_set_ml/1000)/ti;
    }
    return {
      mode:'VC_AC',fio2:v.fio2_percent/100,peep:v.peep,rr:v.rr_set,
      vtL:v.vt_set_ml/1000,inspiratoryFlowLps:flow,inspiratoryPauseSec:0
    };
  }
  throw new Error('unsupported mode');
}

function runCandidate(e,fraction){
  const opts={
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:ventFor(e),
    initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
    patientMechanicsParams:mechanicsParams(
      e.prefit.stiffness_scale,e.prefit.resistance_scale),
    patientDeadSpaceFractionOfTidalVolume:fraction,
    patientArterialGasInitialization:{
      po2MmHg:e.targets.po2,
      pco2MmHg:e.targets.pco2,
      pH:e.targets.ph
    },
    dt:0.010,
    mechanicalWarmupSec:3,
    coupledEquilibrationSec:0,
    physicianValidationCandidate:false
  };
  if(e.hummod_mode==='PS'){
    opts.patientStateProfile='awake_cooperative';
    opts.patientDriveRelativeOverride=e.prefit.drive;
    opts.patientMuscleTransmissionOverride=e.prefit.muscle_transmission;
  }
  const s=createBerlinLiveHumModSession(opts);
  s.initialize();
  const snap=s.runFor(20);
  const g=snap.systemic.gasExchange;
  return {
    fraction,
    pco2:g.paco2MmHg,
    pco2Error:g.paco2MmHg-e.targets.pco2,
    po2:g.pao2MmHg,
    po2Error:g.pao2MmHg-e.targets.po2,
    ph:g.pH,
    phError:g.pH-e.targets.ph
  };
}

const all=JSON.parse(fs.readFileSync(INPUT,'utf8'));
const sample=[];
for(const mode of ['PS','PC_AC']){
  sample.push(...all.filter(x=>x.hummod_mode===mode).slice(0,2));
}
sample.push(...all.filter(x=>x.hummod_mode==='VC_AC').slice(0,1));

const out=[];
for(const e of sample){
  let best=null;
  const candidates=[];
  for(const f of FRACTIONS){
    try{
      const x=runCandidate(e,f);
      candidates.push(x);
      const objective=Math.abs(x.pco2Error);
      if(!best||objective<best.objective) best={...x,objective};
    }catch(err){
      candidates.push({fraction:f,error:String(err.message||err)});
    }
  }
  const row={
    event_id:e.event_id,mode:e.hummod_mode,
    mechanics_or_effort_objective:e.prefit.objective,
    targetPco2:e.targets.pco2,
    best,candidates,
    boundaryHit:best&&(best.fraction===FRACTIONS[0]||best.fraction===FRACTIONS[FRACTIONS.length-1])
  };
  out.push(row);
  console.log(JSON.stringify({
    event_id:e.event_id,mode:e.hummod_mode,
    bestFraction:best&&best.fraction,
    pco2Error:best&&best.pco2Error,
    po2Error:best&&best.po2Error,
    boundaryHit:row.boundaryHit
  }));
}
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
