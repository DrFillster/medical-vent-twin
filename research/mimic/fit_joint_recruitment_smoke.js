'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {Simulation,PcAcController}=require('../../ards-twin-v1.0/src/simulation.js');
const {mechanicsParams}=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/controlled_recruitment_history_6.json';
const OUT='/Users/philipbernard/mimic-data/derived/joint_recruitment_smoke_2.json';

const STIFF=[0.75,1.0,1.25,1.5,1.75,2.0];
const R0=[0.2,0.4,0.6,0.8,1.0];
const Q=[0.10,0.30,0.50];

function clone(x){return JSON.parse(JSON.stringify(x));}
function finite(x){return typeof x==='number'&&Number.isFinite(x);}
function sq(x){return x*x;}

function paramsWithPerfusion(stiffnessScale,q){
  const p=clone(mechanicsParams(stiffnessScale,1.0));
  const non=1-q;
  for(const c of p.compartments){
    if(c.id==='recruitable') c.perfusionFraction=q;
    if(c.id==='normal') c.perfusionFraction=non*(0.55/0.70);
    if(c.id==='consolidated') c.perfusionFraction=non*(0.15/0.70);
  }
  return p;
}

function mechanicalPreVt(e,stiffnessScale,r0){
  const sim=new Simulation({
    params:mechanicsParams(stiffnessScale,1.0),
    controller:new PcAcController({
      fio2:e.vent.fio2_percent/100,
      peep:e.vent.peep_before,
      rr:e.vent.rr_set,
      pinsp:e.vent.pinsp,
      inspiratoryTime:e.vent.inspiratory_time_sec,
      inspiratoryPause:0,
    }),
    dt:0.002,trackGas:false,
    initialRecruitmentState:{normal:1,recruitable:r0,consolidated:0},
  });
  const cycle=60/e.vent.rr_set;
  sim.runFor(Math.max(12,cycle*4));
  const breaths=sim.metrics().filter(b=>finite(b.VtInspired)&&b.VtInspired>0);
  const b=breaths[breaths.length-1];
  return b ? b.VtInspired*1000 : null;
}

function runFull(e,stiffnessScale,r0,q){
  const warmup=Math.max(8,2.5*(60/e.vent.rr_set));
  const s=createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:{
      mode:'PC_AC',
      fio2:e.vent.fio2_percent/100,
      peep:e.vent.peep_before,
      rr:e.vent.rr_set,
      pinspCmH2O:e.vent.pinsp,
      inspiratoryTimeSec:e.vent.inspiratory_time_sec,
      inspiratoryPauseSec:0,
    },
    initialRecruitmentState:{normal:1,recruitable:r0,consolidated:0},
    patientMechanicsParams:paramsWithPerfusion(stiffnessScale,q),
    patientArterialGasInitialization:{
      po2MmHg:e.pre.po2,pco2MmHg:e.pre.pco2,pH:e.pre.ph,
    },
    dt:0.002,mechanicalWarmupSec:warmup,coupledEquilibrationSec:0,
  });
  s.initialize();
  const pre=s.runFor(10);
  const preBreath=pre.pulmonary.measurements.lastValidDeliveredBreath;
  s.setPEEP(e.vent.peep_after);
  const post=s.runFor(30);
  const postBreath=post.pulmonary.measurements.lastValidDeliveredBreath;
  return {
    prePo2:pre.systemic.gasExchange.pao2MmHg,
    postPo2:post.systemic.gasExchange.pao2MmHg,
    preVtMl:preBreath&&preBreath.VtInspired*1000,
    postVtMl:postBreath&&postBreath.VtInspired*1000,
  };
}

const raw=JSON.parse(fs.readFileSync(INPUT,'utf8'));
const seen=new Set(),events=[];
for(const e of raw){
  if(seen.has(e.event_id)) continue;
  seen.add(e.event_id);
  if(finite(e.pre.vt_observed_ml)&&e.pre.vt_observed_ml>=100&&e.pre.vt_observed_ml<=1000) events.push(e);
}

const results=[];
for(const e of events.slice(0,1)){
  const mechCandidates=[];
  for(const s of STIFF){
    for(const r0 of R0){
      try{
        const vt=mechanicalPreVt(e,s,r0);
        if(!finite(vt)) continue;
        const err=Math.abs(vt-e.pre.vt_observed_ml);
        if(err<=Math.max(50,0.30*e.pre.vt_observed_ml)){
          mechCandidates.push({stiffnessScale:s,r0,preVtMl:vt,preVtAbsError:err});
        }
      }catch{}
    }
  }

  mechCandidates.sort((a,b)=>a.preVtAbsError-b.preVtAbsError);
  const shortlisted=mechCandidates.slice(0,3);

  let best=null;
  const candidates=[];
  for(const m of shortlisted){
    for(const q of Q){
      try{
        const model=runFull(e,m.stiffnessScale,m.r0,q);
        if(!finite(model.preVtMl)||!finite(model.postVtMl)||!finite(model.prePo2)||!finite(model.postPo2)) continue;
        const preVtErr=model.preVtMl-e.pre.vt_observed_ml;
        const postVtErr=model.postVtMl-e.post.vt_observed_ml;
        const prePo2Err=model.prePo2-e.pre.po2;
        const postPo2Err=model.postPo2-e.post.po2;
        const objective=
          sq(preVtErr/Math.max(50,0.20*e.pre.vt_observed_ml))+
          sq(postVtErr/Math.max(50,0.20*e.post.vt_observed_ml))+
          sq(prePo2Err/10)+sq(postPo2Err/10);
        const row={...m,q,objective,model,preVtErr,postVtErr,prePo2Err,postPo2Err};
        candidates.push(row);
        if(!best||objective<best.objective) best=row;
      }catch(err){
        candidates.push({...m,q,error:String(err.message||err)});
      }
    }
  }

  const row={
    event_id:e.event_id,
    target:{
      peep:[e.vent.peep_before,e.vent.peep_after],
      preVtMl:e.pre.vt_observed_ml,postVtMl:e.post.vt_observed_ml,
      prePo2:e.pre.po2,postPo2:e.post.po2,
    },
    mechanicalPrefilterCount:mechCandidates.length,
    shortlistedMechanics:shortlisted,
    best,candidates
  };
  results.push(row);
  console.log(JSON.stringify({
    event_id:e.event_id,
    target:row.target,
    mechanicalPrefilterCount:mechCandidates.length,
    best
  }));
}
fs.writeFileSync(OUT,JSON.stringify(results,null,2)+'\n');
