'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { mechanicsParams }=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/primary60_ps_fit_inputs.json';
const OUTDIR='/Users/philipbernard/mimic-data/derived';

const DRIVES=[0.10,0.20,0.35,0.50,0.70,0.95];
const MUSCLE_COARSE=[0.40,0.80,1.20];
const STIFFNESS_COARSE=[0.50,0.75,1.00,1.50];
const MUSCLE_FINE=[0.40,0.55,0.70,0.85,1.00,1.20];
const STIFFNESS_FINE=[0.50,0.625,0.75,0.875,1.00,1.25,1.50];

function sq(x){return x*x;}
function finite(x){return typeof x==='number'&&Number.isFinite(x);}

function targetRr(e){
  if(finite(e.pre_rr_total)) return e.pre_rr_total;
  if(finite(e.pre_rr_spontaneous)) return e.pre_rr_spontaneous;
  return null;
}

function runCandidate(e,{drive,muscleTransmission,stiffnessScale}){
  const session=createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:{
      mode:'PS',
      fio2:e.pre_fio2/100,
      peep:e.pre_peep,
      rr:2,
      pressureSupportCmH2O:e.pre_psv,
    },
    initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
    patientStateProfile:'awake_cooperative',
    patientDriveRelativeOverride:drive,
    patientMuscleTransmissionOverride:muscleTransmission,
    patientMechanicsParams:mechanicsParams(stiffnessScale,1.0),
    dt:0.010,
    mechanicalWarmupSec:3,
    coupledEquilibrationSec:0,
    physicianValidationCandidate:false,
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

function effortScore(e,m){
  let obj=0,n=0;
  const rr=targetRr(e);
  if(finite(rr)&&finite(m.rr)){
    obj+=sq((m.rr-rr)/Math.max(2,0.10*rr)); n++;
  }
  if(finite(e.pre_vt_observed)&&finite(m.vtMl)){
    obj+=sq((m.vtMl-e.pre_vt_observed)/
      Math.max(75,0.15*e.pre_vt_observed)); n++;
  }
  if(finite(e.pre_minute_volume)&&finite(m.mv)){
    obj+=sq((m.mv-e.pre_minute_volume)/
      Math.max(1,0.15*e.pre_minute_volume)); n++;
  }
  return n?obj/n:Infinity;
}

function fitGrid(e,drive,muscles,stiffnesses){
  let best=null;
  let tested=0,failed=0,rejected=0;
  for(const muscleTransmission of muscles){
    for(const stiffnessScale of stiffnesses){
      try{
        const m=runCandidate(e,{drive,muscleTransmission,stiffnessScale});
        tested++;
        if(!m.effortTriggered){
          rejected++;
          continue;
        }
        const objective=effortScore(e,m);
        const row={drive,muscleTransmission,stiffnessScale,objective,model:m};
        if(Number.isFinite(objective)&&(!best||objective<best.objective)) best=row;
      }catch(_){
        failed++;
      }
    }
  }
  return {best,tested,failed,rejected};
}

function fitEvent(e){
  let bestTiming=null;
  let timingTested=0;
  for(const drive of DRIVES){
    try{
      const m=runCandidate(e,{drive,muscleTransmission:1.0,stiffnessScale:1.0});
      timingTested++;
      if(!m.effortTriggered) continue;
      const rr=targetRr(e);
      if(!finite(rr)) continue;
      const rrObjective=sq((m.rr-rr)/Math.max(2,0.10*rr));
      if(!bestTiming||rrObjective<bestTiming.rrObjective){
        bestTiming={drive,rrObjective,model:m};
      }
    }catch(_){}
  }
  if(!bestTiming){
    return {status:'failed_timing',timingTested};
  }

  const coarse=fitGrid(e,bestTiming.drive,MUSCLE_COARSE,STIFFNESS_COARSE);
  let finalFit=coarse;
  let refinementApplied=false;
  if(coarse.best && coarse.best.objective>0.50){
    const fine=fitGrid(e,bestTiming.drive,MUSCLE_FINE,STIFFNESS_FINE);
    refinementApplied=true;
    if(fine.best && (!coarse.best || fine.best.objective<coarse.best.objective)){
      finalFit={
        best:fine.best,
        tested:coarse.tested+fine.tested,
        failed:coarse.failed+fine.failed,
        rejected:coarse.rejected+fine.rejected
      };
    }else{
      finalFit={
        best:coarse.best,
        tested:coarse.tested+fine.tested,
        failed:coarse.failed+fine.failed,
        rejected:coarse.rejected+fine.rejected
      };
    }
  }

  return {
    status:finalFit.best?'completed':'failed_effort',
    bestTiming,
    best:finalFit.best,
    timingTested,
    candidateTested:finalFit.tested,
    candidateFailed:finalFit.failed,
    candidateRejected:finalFit.rejected,
    refinementApplied,
    quality:finalFit.best
      ? (finalFit.best.objective<=0.5?'strong':
         finalFit.best.objective<=1.0?'acceptable':'weak')
      : 'failed'
  };
}

const all=JSON.parse(fs.readFileSync(INPUT,'utf8'));
const eventIndex=process.env.EVENT_INDEX==null?null:Number(process.env.EVENT_INDEX);
const startIndex=process.env.START_INDEX==null?0:Number(process.env.START_INDEX);
const limit=process.env.FIT_LIMIT==null?all.length-startIndex:Number(process.env.FIT_LIMIT);
const selected=eventIndex==null?all.slice(startIndex,startIndex+limit):[all[eventIndex]];
const out=[];

for(const e of selected){
  const fit=fitEvent(e);
  const row={
    event_id:e.event_id,
    transition_itemid:e.transition_itemid,
    effort_observable_count:e.effort_observable_count,
    target:{
      rr:targetRr(e),
      vtMl:e.pre_vt_observed,
      mv:e.pre_minute_volume
    },
    ...fit
  };
  out.push(row);
  console.log(JSON.stringify({
    event_id:e.event_id,
    status:fit.status,
    quality:fit.quality,
    drive:fit.best&&fit.best.drive,
    muscle:fit.best&&fit.best.muscleTransmission,
    stiffness:fit.best&&fit.best.stiffnessScale,
    objective:fit.best&&fit.best.objective,
    async:fit.best&&fit.best.model.asynchronyIndex,
    refinement:fit.refinementApplied
  }));
}

const suffix=eventIndex==null
  ? ('batch_'+startIndex+'_'+(startIndex+selected.length-1))
  : String(eventIndex);
fs.writeFileSync(OUTDIR+'/primary60_ps_effort_fit_'+suffix+'.json',
  JSON.stringify(out,null,2)+'\n');

module.exports={fitEvent,runCandidate,effortScore};
