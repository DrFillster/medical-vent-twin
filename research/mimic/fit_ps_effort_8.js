'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { mechanicsParams }=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/ps_etco2_effort_targets.json';
const OUT=process.env.EVENT_INDEX==null
  ? '/Users/philipbernard/mimic-data/derived/ps_effort_fit_8.json'
  : `/Users/philipbernard/mimic-data/derived/ps_effort_fit_${process.env.EVENT_INDEX}.json`;

const DRIVES=[0.10,0.20,0.35,0.50,0.70,0.95];
const MUSCLE=[0.40,0.55,0.70,0.85,1.00,1.20];
const STIFFNESS=[0.5,0.75,1.0,1.25,1.5];

function sq(x){return x*x;}
function finite(x){return typeof x==='number'&&Number.isFinite(x);}

function runCandidate(e,{drive,muscleTransmission,stiffnessScale}){
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
    patientDriveRelativeOverride:drive,
    patientMuscleTransmissionOverride:muscleTransmission,
    patientMechanicsParams:mechanicsParams(stiffnessScale,1.0),
    dt:0.002,
    mechanicalWarmupSec:3,
    coupledEquilibrationSec:0,
  });
  session.initialize();
  const snap=session.runFor(15);
  const b=snap.pulmonary.measurements.lastCompletedBreath;
  const i=snap.patientVentilatorInteraction;
  if(!b) throw new Error('no completed breath');
  const effortTriggered=
    i.totalVentilatorBreaths>0 &&
    i.totalEfforts>=Math.max(1,0.8*i.totalVentilatorBreaths);
  return {
    effortTriggered,
    rr:b.RR,
    vtMl:b.VtInspired*1000,
    mv:b.MV,
    totalEfforts:i.totalEfforts,
    totalVentilatorBreaths:i.totalVentilatorBreaths,
    asynchronyIndex:i.asynchronyIndex,
  };
}

const allEvents=JSON.parse(fs.readFileSync(INPUT,'utf8'));
const eventIndex=process.env.EVENT_INDEX==null?null:Number(process.env.EVENT_INDEX);
const events=eventIndex==null?allEvents:[allEvents[eventIndex]];
const results=[];

for(const e of events){
  let bestTiming=null;
  for(const drive of DRIVES){
    try{
      const m=runCandidate(e,{drive,muscleTransmission:1.0,stiffnessScale:1.0});
      if(!m.effortTriggered) continue;
      const rrObjective=sq((m.rr-e.rr_total)/Math.max(2,0.10*e.rr_total));
      if(!bestTiming||rrObjective<bestTiming.rrObjective){
        bestTiming={drive,rrObjective,model:m};
      }
    }catch(_){}
  }

  let best=null;
  if(bestTiming){
    for(const muscleTransmission of MUSCLE){
      for(const stiffnessScale of STIFFNESS){
        try{
          const m=runCandidate(e,{
            drive:bestTiming.drive,
            muscleTransmission,
            stiffnessScale
          });
          if(!m.effortTriggered) continue;
          let obj=0,n=0;
          if(finite(e.rr_total)){
            obj+=sq((m.rr-e.rr_total)/Math.max(2,0.10*e.rr_total)); n++;
          }
          if(finite(e.vt_ml)){
            obj+=sq((m.vtMl-e.vt_ml)/Math.max(75,0.15*e.vt_ml)); n++;
          }
          if(finite(e.mv)){
            obj+=sq((m.mv-e.mv)/Math.max(1,0.15*e.mv)); n++;
          }
          obj=n?obj/n:Infinity;
          if(Number.isFinite(obj)&&(!best||obj<best.objective)){
            best={drive:bestTiming.drive,muscleTransmission,stiffnessScale,objective:obj,model:m};
          }
        }catch(_){}
      }
    }
  }
  const row={
    event_id:e.event_id,
    measuredGradient:e.measured_gradient,
    quality:e.quality,
    target:{rr:e.rr_total,vtMl:e.vt_ml,mv:e.mv},
    bestTiming,
    best
  };
  results.push(row);
  console.log(JSON.stringify({
    event_id:e.event_id,
    gradient:e.measured_gradient,
    drive:best&&best.drive,
    muscle:best&&best.muscleTransmission,
    stiffness:best&&best.stiffnessScale,
    objective:best&&best.objective,
    model:best&&best.model,
    target:row.target
  }));
}

fs.writeFileSync(OUT,JSON.stringify(results,null,2)+'\n');
