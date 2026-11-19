'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { mechanicsParams }=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/primary60_conservative_prefit.json';
const OUTDIR='/Users/philipbernard/mimic-data/derived';
const PERF=[0.40,0.50,0.60,0.70,0.80,0.90,0.95,1.00];

function ventFor(e){
  const v=e.vent;
  if(e.hummod_mode==='PS'){
    return {mode:'PS',fio2:v.fio2_percent/100,peep:v.peep,rr:2,
      pressureSupportCmH2O:v.psv};
  }
  if(e.hummod_mode==='PC_AC'){
    return {mode:'PC_AC',fio2:v.fio2_percent/100,peep:v.peep,rr:v.rr_set,
      pinspCmH2O:v.pinsp,inspiratoryTimeSec:v.inspiratory_time_sec,
      inspiratoryPauseSec:0};
  }
  if(e.hummod_mode==='VC_AC'){
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

function runCandidate(e,perf){
  const opts={
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:ventFor(e),
    initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
    patientMechanicsParams:mechanicsParams(
      e.prefit.stiffness_scale,e.prefit.resistance_scale),
    patientVentilatedPerfusionFractionOverride:perf,
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
  if(e.measured_deadspace &&
     ['A','B'].includes(e.measured_deadspace.quality) &&
     e.measured_deadspace.fraction!=null){
    opts.patientDeadSpaceFractionOfTidalVolume=e.measured_deadspace.fraction;
  }
  if(e.hummod_mode==='PS'){
    opts.patientStateProfile='awake_cooperative';
    opts.patientDriveRelativeOverride=e.prefit.drive;
    opts.patientMuscleTransmissionOverride=e.prefit.muscle_transmission;
  }
  const s=createBerlinLiveHumModSession(opts);
  s.initialize();
  const snap=s.runFor(20);
  return {
    perfusionFraction:perf,
    po2:snap.systemic.gasExchange.pao2MmHg,
    po2Error:snap.systemic.gasExchange.pao2MmHg-e.targets.po2,
    pco2:snap.systemic.gasExchange.paco2MmHg,
    pco2Error:snap.systemic.gasExchange.paco2MmHg-e.targets.pco2
  };
}

const all=JSON.parse(fs.readFileSync(INPUT,'utf8'));
const startIndex=process.env.START_INDEX==null?0:Number(process.env.START_INDEX);
const limit=process.env.FIT_LIMIT==null?all.length-startIndex:Number(process.env.FIT_LIMIT);
const sample=all.slice(startIndex,startIndex+limit);

const out=[];
for(const e of sample){
  let best=null;
  const candidates=[];
  for(const perf of PERF){
    try{
      const x=runCandidate(e,perf);
      candidates.push(x);
      const objective=Math.abs(x.po2Error);
      if(!best||objective<best.objective) best={...x,objective};
    }catch(err){
      candidates.push({perfusionFraction:perf,error:String(err.message||err)});
    }
  }
  const row={
    event_id:e.event_id,mode:e.hummod_mode,
    best,candidates,
    boundaryHit:best&&(best.perfusionFraction===PERF[0]||
      best.perfusionFraction===PERF[PERF.length-1])
  };
  out.push(row);
  console.log(JSON.stringify({
    event_id:e.event_id,mode:e.hummod_mode,
    perf:best&&best.perfusionFraction,
    po2Error:best&&best.po2Error,
    pco2Error:best&&best.pco2Error,
    boundaryHit:row.boundaryHit
  }));
}
const suffix='batch_'+startIndex+'_'+(startIndex+sample.length-1);
fs.writeFileSync(OUTDIR+'/primary60_oxygenation_fit_'+suffix+'.json',
  JSON.stringify(out,null,2)+'\n');
