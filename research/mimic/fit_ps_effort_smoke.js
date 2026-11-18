'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { mechanicsParams }=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/ps_etco2_effort_targets.json';
const OUT='/Users/philipbernard/mimic-data/derived/ps_effort_smoke_2.json';

const PROFILES=[
  'passive_paralyzed',
  'sedated_breathing',
  'awake_cooperative',
  'agitated_high_drive'
];
const STIFFNESS=[0.5,0.75,1.0,1.25,1.5,2.0];

function sq(x){return x*x;}
function finite(x){return typeof x==='number'&&Number.isFinite(x);}

function score(target,b){
  let s=0,n=0;
  if(finite(target.rr_total)&&finite(b.RR)){
    s+=sq((b.RR-target.rr_total)/Math.max(2,0.10*target.rr_total)); n++;
  }
  if(finite(target.vt_ml)&&finite(b.VtInspired)){
    s+=sq((b.VtInspired*1000-target.vt_ml)/Math.max(75,0.15*target.vt_ml)); n++;
  }
  if(finite(target.mv)&&finite(b.MV)){
    s+=sq((b.MV-target.mv)/Math.max(1,0.15*target.mv)); n++;
  }
  return n?s/n:Infinity;
}

const events=JSON.parse(fs.readFileSync(INPUT,'utf8')).slice(0,2);
const results=[];

for(const e of events){
  let best=null;
  const candidates=[];
  for(const profile of PROFILES){
    for(const stiffnessScale of STIFFNESS){
      try{
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
          patientMechanicsParams:mechanicsParams(stiffnessScale,1.0),
          dt:0.002,
          mechanicalWarmupSec:3,
          coupledEquilibrationSec:0,
        });
        session.initialize();
        const snap=session.runFor(20);
        const b=snap.pulmonary.measurements.lastCompletedBreath;
        const i=snap.patientVentilatorInteraction;
        const effortTriggered=
          i.totalVentilatorBreaths>0 &&
          i.totalEfforts>=Math.max(1,0.8*i.totalVentilatorBreaths);
        if(!b || !effortTriggered){
          candidates.push({profile,stiffnessScale,rejected:'backup_or_no_effort'});
          continue;
        }
        const objective=score(e,b);
        const model={
          rr:b.RR,vtMl:b.VtInspired*1000,mv:b.MV,
          totalEfforts:i.totalEfforts,
          totalVentilatorBreaths:i.totalVentilatorBreaths,
          asynchronyIndex:i.asynchronyIndex,
        };
        const row={profile,stiffnessScale,objective,model};
        candidates.push(row);
        if(Number.isFinite(objective)&&(!best||objective<best.objective)) best=row;
      }catch(err){
        candidates.push({profile,stiffnessScale,error:String(err.message||err)});
      }
    }
  }
  results.push({event_id:e.event_id,target:e,best,candidates});
  console.log(JSON.stringify({
    event_id:e.event_id,
    measuredGradient:e.measured_gradient,
    bestProfile:best&&best.profile,
    stiffnessScale:best&&best.stiffnessScale,
    objective:best&&best.objective,
    model:best&&best.model,
    target:{rr:e.rr_total,vtMl:e.vt_ml,mv:e.mv}
  }));
}
fs.writeFileSync(OUT,JSON.stringify(results,null,2)+'\n');
