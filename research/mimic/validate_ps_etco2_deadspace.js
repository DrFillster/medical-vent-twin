'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {mechanicsParams}=require('./fit_controlled_mechanics.js');

const TARGETS='/Users/philipbernard/mimic-data/derived/ps_etco2_effort_targets.json';
const FIT='/Users/philipbernard/mimic-data/derived/ps_compliance_constrained_effort.json';
const OUT='/Users/philipbernard/mimic-data/derived/ps_etco2_deadspace_validation.json';

const DEADSPACE=[0.05,0.10,0.20,0.30,0.40,0.50,0.60,0.70,0.80];

const targets=new Map(JSON.parse(fs.readFileSync(TARGETS,'utf8')).map(x=>[x.event_id,x]));
const fits=JSON.parse(fs.readFileSync(FIT,'utf8'));

function acceptableFit(f){
  if(!f.best || !(f.best.objective<=1.0)) return false;
  const m=f.best.model;
  if(!m || !(m.totalEfforts>0&&m.totalVentilatorBreaths>0)) return false;
  const ratio1=m.totalEfforts/m.totalVentilatorBreaths;
  const ratio2=m.totalVentilatorBreaths/m.totalEfforts;
  return ratio1>=0.8 && ratio2>=0.8 && (m.asynchronyIndex||0)<=0.25;
}

function runCandidate(e,f,fraction){
  const session=createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:{
      mode:'PS',
      fio2:e.fio2/100,
      peep:e.peep,
      rr:2,
      pressureSupportCmH2O:e.psv,
    },
    initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
    patientStateProfile:'awake_cooperative',
    patientDriveRelativeOverride:f.drive,
    patientMuscleTransmissionOverride:f.best.muscle,
    patientMechanicsParams:mechanicsParams(f.stiffnessScale,1.0),
    patientDeadSpaceFractionOfTidalVolume:fraction,
    patientArterialGasInitialization:{
      po2MmHg:e.po2,
      pco2MmHg:e.pco2,
      pH:e.ph,
    },
    dt:0.002,
    mechanicalWarmupSec:3,
    coupledEquilibrationSec:0,
  });
  session.initialize();
  const s=session.runFor(20);
  const g=s.systemic.gasExchange;
  const b=s.pulmonary.measurements.lastCompletedBreath;
  const i=s.patientVentilatorInteraction;
  return {
    pco2:g.paco2MmHg,
    po2:g.pao2MmHg,
    pH:g.pH,
    rr:b&&b.RR,
    vtMl:b&&b.VtInspired*1000,
    mv:b&&b.MV,
    totalEfforts:i.totalEfforts,
    totalVentilatorBreaths:i.totalVentilatorBreaths,
    asynchronyIndex:i.asynchronyIndex,
  };
}

const results=[];
for(const f of fits.filter(acceptableFit)){
  const e=targets.get(f.event_id);
  if(!e) continue;
  const candidates=[];
  let best=null;
  for(const fraction of DEADSPACE){
    try{
      const model=runCandidate(e,f,fraction);
      const pco2Error=model.pco2-e.pco2;
      const objective=Math.abs(pco2Error);
      const row={fraction,objective,pco2Error,model};
      candidates.push(row);
      if(!best||objective<best.objective) best=row;
    }catch(err){
      candidates.push({fraction,error:String(err.message||err)});
    }
  }
  const row={
    event_id:e.event_id,
    quality:e.quality,
    measuredGradient:e.measured_gradient,
    drive:f.drive,
    muscle:f.best.muscle,
    stiffnessScale:f.stiffnessScale,
    effortObjective:f.best.objective,
    best,
    candidates,
    target:{pco2:e.pco2,po2:e.po2,pH:e.ph,rr:e.rr_total,vtMl:e.vt_ml,mv:e.mv},
  };
  results.push(row);
  console.log(JSON.stringify({
    event_id:e.event_id,
    measuredGradient:e.measured_gradient,
    bestDeadSpace:best&&best.fraction,
    pco2Error:best&&best.pco2Error,
    effortObjective:f.best.objective
  }));
}
fs.writeFileSync(OUT,JSON.stringify(results,null,2)+'\n');
console.log('accepted_events',results.length);
