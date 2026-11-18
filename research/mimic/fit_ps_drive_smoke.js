'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { mechanicsParams }=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/ps_etco2_effort_targets.json';
const OUT='/Users/philipbernard/mimic-data/derived/ps_drive_smoke_2.json';

const PROFILES=['sedated_breathing','awake_cooperative','agitated_high_drive'];
const DRIVES=[0.10,0.20,0.35,0.50,0.70,0.95];
const STIFFNESS=[0.5,0.75,1.0,1.25,1.5];

function sq(x){return x*x;}
function finite(x){return typeof x==='number'&&Number.isFinite(x);}

function runCandidate(e,{profile,drive,stiffnessScale}){
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
    patientStateProfile:profile,
    patientDriveRelativeOverride:drive,
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

const events=JSON.parse(fs.readFileSync(INPUT,'utf8')).slice(0,2);
const results=[];

for(const e of events){
  // Stage 1: choose profile + drive from RR only, at neutral stiffness.
  let bestTiming=null;
  const timingCandidates=[];
  for(const profile of PROFILES){
    for(const drive of DRIVES){
      try{
        const m=runCandidate(e,{profile,drive,stiffnessScale:1.0});
        if(!m.effortTriggered){
          timingCandidates.push({profile,drive,rejected:'backup_or_no_effort',model:m});
          continue;
        }
        const rrObjective=sq((m.rr-e.rr_total)/Math.max(2,0.10*e.rr_total));
        const row={profile,drive,rrObjective,model:m};
        timingCandidates.push(row);
        if(!bestTiming||rrObjective<bestTiming.rrObjective) bestTiming=row;
      }catch(err){
        timingCandidates.push({profile,drive,error:String(err.message||err)});
      }
    }
  }

  // Stage 2: with timing state fixed, fit stiffness from VT/MV.
  let bestMechanics=null;
  const mechanicsCandidates=[];
  if(bestTiming){
    for(const stiffnessScale of STIFFNESS){
      try{
        const m=runCandidate(e,{
          profile:bestTiming.profile,
          drive:bestTiming.drive,
          stiffnessScale
        });
        if(!m.effortTriggered){
          mechanicsCandidates.push({stiffnessScale,rejected:'backup_or_no_effort',model:m});
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
        const row={stiffnessScale,objective:obj,model:m};
        mechanicsCandidates.push(row);
        if(Number.isFinite(obj)&&(!bestMechanics||obj<bestMechanics.objective)) bestMechanics=row;
      }catch(err){
        mechanicsCandidates.push({stiffnessScale,error:String(err.message||err)});
      }
    }
  }

  const out={
    event_id:e.event_id,
    target:{rr:e.rr_total,vtMl:e.vt_ml,mv:e.mv},
    measuredGradient:e.measured_gradient,
    bestTiming,
    bestMechanics,
    timingCandidates,
    mechanicsCandidates,
  };
  results.push(out);
  console.log(JSON.stringify({
    event_id:e.event_id,
    measuredGradient:e.measured_gradient,
    bestProfile:bestTiming&&bestTiming.profile,
    bestDrive:bestTiming&&bestTiming.drive,
    timingRR:bestTiming&&bestTiming.model.rr,
    targetRR:e.rr_total,
    bestStiffness:bestMechanics&&bestMechanics.stiffnessScale,
    objective:bestMechanics&&bestMechanics.objective,
    model:bestMechanics&&bestMechanics.model,
    target:{rr:e.rr_total,vtMl:e.vt_ml,mv:e.mv}
  }));
}
fs.writeFileSync(OUT,JSON.stringify(results,null,2)+'\n');
