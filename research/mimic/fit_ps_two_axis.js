'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { mechanicsParams }=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/ps_etco2_effort_targets.json';
const OFFSET=Number(process.env.FIT_OFFSET||0);
const LIMIT=Number(process.env.FIT_LIMIT||4);
const OUT=`/Users/philipbernard/mimic-data/derived/ps_two_axis_fit_${OFFSET}_${OFFSET+LIMIT-1}.json`;

const DRIVES=[0.10,0.15,0.20,0.25,0.30,0.35,0.45];
const MUSCLE=[0.40,0.70,1.00,1.20];
const STIFFNESS=[0.50,0.75,1.00,1.25,1.50];

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
  const snap=session.runFor(10);
  const b=snap.pulmonary.measurements.lastCompletedBreath;
  const i=snap.patientVentilatorInteraction;
  if(!b) throw new Error('no completed breath');
  const patientTriggered=
    i.totalVentilatorBreaths>0 && i.totalEfforts>0 &&
    i.totalEfforts>=Math.max(1,0.8*i.totalVentilatorBreaths) &&
    i.totalVentilatorBreaths>=Math.max(1,0.8*i.totalEfforts);
  return {
    patientTriggered,
    rr:b.RR,
    vtMl:b.VtInspired*1000,
    mv:b.MV,
    totalEfforts:i.totalEfforts,
    totalVentilatorBreaths:i.totalVentilatorBreaths,
    asynchronyIndex:i.asynchronyIndex,
  };
}

const all=JSON.parse(fs.readFileSync(INPUT,'utf8'));
const events=all.slice(OFFSET,OFFSET+LIMIT);
const results=[];

for(const e of events){
  let bestTiming=null;
  const timingCandidates=[];
  for(const drive of DRIVES){
    try{
      const m=runCandidate(e,{drive,muscleTransmission:1.0,stiffnessScale:1.0});
      if(!m.patientTriggered){
        timingCandidates.push({drive,rejected:'backup_or_no_effort',model:m});
        continue;
      }
      const rrObjective=sq((m.rr-e.rr_total)/Math.max(2,0.10*e.rr_total));
      const row={drive,rrObjective,model:m};
      timingCandidates.push(row);
      if(!bestTiming||rrObjective<bestTiming.rrObjective) bestTiming=row;
    }catch(err){
      timingCandidates.push({drive,error:String(err.message||err)});
    }
  }

  let bestAmplitude=null;
  const amplitudeCandidates=[];
  if(bestTiming){
    for(const muscleTransmission of MUSCLE){
      for(const stiffnessScale of STIFFNESS){
        try{
          const m=runCandidate(e,{
            drive:bestTiming.drive,
            muscleTransmission,
            stiffnessScale
          });
          if(!m.patientTriggered){
            amplitudeCandidates.push({
              muscleTransmission,stiffnessScale,
              rejected:'backup_or_no_effort',model:m
            });
            continue;
          }
          let obj=0,n=0;
          if(finite(e.vt_ml)){
            obj+=sq((m.vtMl-e.vt_ml)/Math.max(75,0.15*e.vt_ml)); n++;
          }
          if(finite(e.mv)){
            obj+=sq((m.mv-e.mv)/Math.max(1,0.15*e.mv)); n++;
          }
          if(finite(e.rr_total)){
            obj+=sq((m.rr-e.rr_total)/Math.max(2,0.10*e.rr_total)); n++;
          }
          obj=n?obj/n:Infinity;
          const row={muscleTransmission,stiffnessScale,objective:obj,model:m};
          amplitudeCandidates.push(row);
          if(Number.isFinite(obj)&&(!bestAmplitude||obj<bestAmplitude.objective)){
            bestAmplitude=row;
          }
        }catch(err){
          amplitudeCandidates.push({
            muscleTransmission,stiffnessScale,error:String(err.message||err)
          });
        }
      }
    }
  }

  const fit={
    event_id:e.event_id,
    quality:e.quality,
    measuredGradient:e.measured_gradient,
    target:{rr:e.rr_total,vtMl:e.vt_ml,mv:e.mv},
    bestDrive:bestTiming&&bestTiming.drive,
    timingObjective:bestTiming&&bestTiming.rrObjective,
    bestMuscleTransmission:bestAmplitude&&bestAmplitude.muscleTransmission,
    bestStiffness:bestAmplitude&&bestAmplitude.stiffnessScale,
    objective:bestAmplitude&&bestAmplitude.objective,
    model:bestAmplitude&&bestAmplitude.model,
    timingCandidates,
    amplitudeCandidates,
  };
  results.push(fit);
  console.log(JSON.stringify({
    event_id:fit.event_id,
    gradient:fit.measuredGradient,
    drive:fit.bestDrive,
    muscle:fit.bestMuscleTransmission,
    stiffness:fit.bestStiffness,
    objective:fit.objective,
    model:fit.model,
    target:fit.target
  }));
}
fs.writeFileSync(OUT,JSON.stringify(results,null,2)+'\n');
