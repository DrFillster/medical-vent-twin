'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {mechanicsParams}=require('./fit_controlled_mechanics.js');

const TARGETS='/Users/philipbernard/mimic-data/derived/ps_etco2_effort_targets.json';
const FIT='/Users/philipbernard/mimic-data/derived/ps_compliance_constrained_effort.json';
const OUT='/Users/philipbernard/mimic-data/derived/ps_deadspace_horizon_stability.json';

const DEADSPACE=[0.05,0.10,0.20,0.30,0.40];
const HORIZONS=[5,10,20];

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

function runCandidate(e,f,fraction,horizonSec){
  const session=createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:{
      mode:'PS',fio2:e.fio2/100,peep:e.peep,rr:2,
      pressureSupportCmH2O:e.psv,
    },
    initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
    patientStateProfile:'awake_cooperative',
    patientDriveRelativeOverride:f.drive,
    patientMuscleTransmissionOverride:f.best.muscle,
    patientMechanicsParams:mechanicsParams(f.stiffnessScale,1.0),
    patientDeadSpaceFractionOfTidalVolume:fraction,
    patientArterialGasInitialization:{
      po2MmHg:e.po2,pco2MmHg:e.pco2,pH:e.ph,
    },
    dt:0.002,mechanicalWarmupSec:3,coupledEquilibrationSec:0,
  });
  session.initialize();
  const s=session.runFor(horizonSec);
  const g=s.systemic.gasExchange;
  return {
    pco2:g.paco2MmHg,
    pco2Error:g.paco2MmHg-e.pco2,
    po2:g.pao2MmHg,
    pH:g.pH,
  };
}

const results=[];
for(const f of fits.filter(acceptableFit)){
  const e=targets.get(f.event_id);
  if(!e) continue;
  const byHorizon=[];
  for(const horizonSec of HORIZONS){
    let best=null;
    const candidates=[];
    for(const fraction of DEADSPACE){
      try{
        const model=runCandidate(e,f,fraction,horizonSec);
        const objective=Math.abs(model.pco2Error);
        const row={fraction,objective,model};
        candidates.push(row);
        if(!best||objective<best.objective) best=row;
      }catch(err){
        candidates.push({fraction,error:String(err.message||err)});
      }
    }
    byHorizon.push({horizonSec,best,candidates});
  }
  const row={
    event_id:e.event_id,
    measuredGradient:e.measured_gradient,
    byHorizon
  };
  results.push(row);
  console.log(JSON.stringify({
    event_id:e.event_id,
    gradient:e.measured_gradient,
    best5:byHorizon[0].best&&byHorizon[0].best.fraction,
    best10:byHorizon[1].best&&byHorizon[1].best.fraction,
    best20:byHorizon[2].best&&byHorizon[2].best.fraction,
    err5:byHorizon[0].best&&byHorizon[0].best.model.pco2Error,
    err10:byHorizon[1].best&&byHorizon[1].best.model.pco2Error,
    err20:byHorizon[2].best&&byHorizon[2].best.model.pco2Error
  }));
}
fs.writeFileSync(OUT,JSON.stringify(results,null,2)+'\n');
