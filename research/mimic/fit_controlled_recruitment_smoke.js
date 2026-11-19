'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {Simulation,PcAcController}=require('../../ards-twin-v1.0/src/simulation.js');
const {mechanicsParams}=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/controlled_recruitment_history_6.json';
const OUT='/Users/philipbernard/mimic-data/derived/controlled_recruitment_smoke_2.json';

const STIFFNESS=[0.4,0.5,0.6,0.75,1.0,1.25,1.5,2.0];
const RECRUITABLE_PERFUSION=[0.10,0.20,0.30,0.40,0.50,0.60];

function clone(x){return JSON.parse(JSON.stringify(x));}
function finite(x){return typeof x==='number'&&Number.isFinite(x);}

function paramsWithPerfusion(stiffnessScale,recruitablePerfusion){
  const p=clone(mechanicsParams(stiffnessScale,1.0));
  const nonRecruitable=1-recruitablePerfusion;
  const normalShare=0.55/(0.55+0.15);
  const consolidatedShare=0.15/(0.55+0.15);
  for(const c of p.compartments){
    if(c.id==='recruitable') c.perfusionFraction=recruitablePerfusion;
    if(c.id==='normal') c.perfusionFraction=nonRecruitable*normalShare;
    if(c.id==='consolidated') c.perfusionFraction=nonRecruitable*consolidatedShare;
  }
  return p;
}

function fitStiffness(e){
  let best=null;
  for(const s of STIFFNESS){
    const sim=new Simulation({
      params:mechanicsParams(s,1.0),
      controller:new PcAcController({
        fio2:e.vent.fio2_percent/100,
        peep:e.vent.peep_before,
        rr:e.vent.rr_set,
        pinsp:e.vent.pinsp,
        inspiratoryTime:e.vent.inspiratory_time_sec,
        inspiratoryPause:0,
      }),
      dt:0.002,
      trackGas:false,
      initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
    });
    const period=60/e.vent.rr_set;
    sim.runFor(period*5);
    const breaths=sim.metrics().filter(b=>finite(b.VtInspired)&&b.VtInspired>0);
    const b=breaths[breaths.length-1];
    if(!b) continue;
    const vt=b.VtInspired*1000;
    const err=Math.abs(vt-e.pre.vt_observed_ml);
    const row={stiffnessScale:s,modelVtMl:vt,absVtErrorMl:err};
    if(!best||err<best.absVtErrorMl) best=row;
  }
  return best;
}

function runRecruitmentCandidate(e,stiffnessScale,recruitablePerfusion){
  const session=createBerlinLiveHumModSession({
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
    initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
    patientMechanicsParams:paramsWithPerfusion(stiffnessScale,recruitablePerfusion),
    patientArterialGasInitialization:{
      po2MmHg:e.pre.po2,
      pco2MmHg:e.pre.pco2,
      pH:e.pre.ph,
    },
    dt:0.002,
    mechanicalWarmupSec:3,
    coupledEquilibrationSec:0,
  });
  session.initialize();
  const before=session.runFor(10);
  session.setPEEP(e.vent.peep_after);
  const after=session.runFor(30);
  return {
    preModelPo2:before.systemic.gasExchange.pao2MmHg,
    postModelPo2:after.systemic.gasExchange.pao2MmHg,
    postModelPco2:after.systemic.gasExchange.paco2MmHg,
    postModelPH:after.systemic.gasExchange.pH,
    recruitment:after.pulmonary.measurements.lastCompletedBreath
      ? after.pulmonary.measurements.lastCompletedBreath.compartments
      : null,
  };
}

const raw=JSON.parse(fs.readFileSync(INPUT,'utf8'));
const seen=new Set();
const events=[];
for(const e of raw){
  if(seen.has(e.event_id)) continue;
  seen.add(e.event_id);
  const vt=e.pre.vt_observed_ml;
  if(!(finite(vt)&&vt>=100&&vt<=1000)) continue;
  events.push(e);
}

const results=[];
for(const e of events){
  const stiffness=fitStiffness(e);
  let best=null;
  const candidates=[];
  for(const q of RECRUITABLE_PERFUSION){
    try{
      const model=runRecruitmentCandidate(e,stiffness.stiffnessScale,q);
      const po2Error=model.postModelPo2-e.post.po2;
      const objective=Math.abs(po2Error);
      const row={recruitablePerfusion:q,objective,po2Error,model};
      candidates.push(row);
      if(!best||objective<best.objective) best=row;
    }catch(err){
      candidates.push({recruitablePerfusion:q,error:String(err.message||err)});
    }
  }
  const row={
    event_id:e.event_id,
    peepBefore:e.vent.peep_before,
    peepAfter:e.vent.peep_after,
    targetPrePo2:e.pre.po2,
    targetPostPo2:e.post.po2,
    stiffness,
    best,
    candidates,
  };
  results.push(row);
  console.log(JSON.stringify({
    event_id:e.event_id,
    peep:[e.vent.peep_before,e.vent.peep_after],
    stiffness,
    observedPo2:[e.pre.po2,e.post.po2],
    bestPerfusion:best&&best.recruitablePerfusion,
    modeledPostPo2:best&&best.model.postModelPo2,
    postPo2Error:best&&best.po2Error
  }));
}

fs.writeFileSync(OUT,JSON.stringify(results,null,2)+'\n');
console.log('events',results.length);
