'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {mechanicsParams}=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/controlled_recruitment_history_6.json';
const OUT='/Users/philipbernard/mimic-data/derived/recruitment_two_stage_smoke.json';

const VPF=[0.40,0.50,0.60,0.70,0.80,0.90,0.95,1.00];
const Q=[0.10,0.20,0.30,0.40,0.50,0.60];
const R0=[0.10,0.30,0.50,0.70,0.90];

function clone(x){return JSON.parse(JSON.stringify(x));}
function finite(x){return typeof x==='number'&&Number.isFinite(x);}
function sq(x){return x*x;}

function paramsWithRecruitablePerfusion(stiffnessScale,q){
  const p=clone(mechanicsParams(stiffnessScale,1.0));
  const non=1-q;
  const normalShare=0.55/0.70;
  const consolidatedShare=0.15/0.70;
  for(const c of p.compartments){
    if(c.id==='recruitable') c.perfusionFraction=q;
    if(c.id==='normal') c.perfusionFraction=non*normalShare;
    if(c.id==='consolidated') c.perfusionFraction=non*consolidatedShare;
  }
  return p;
}

function sessionArgs(e,stiffnessScale,extra={}){
  return {
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
    patientArterialGasInitialization:{
      po2MmHg:e.pre.po2,pco2MmHg:e.pre.pco2,pH:e.pre.ph,
    },
    dt:0.002,mechanicalWarmupSec:3,coupledEquilibrationSec:0,
    ...extra,
  };
}

const raw=JSON.parse(fs.readFileSync(INPUT,'utf8'));
const seen=new Set();
const events=[];
for(const e of raw){
  if(seen.has(e.event_id)) continue;
  seen.add(e.event_id);
  if(e.event_id==='RCR-3c238f0dd76b') events.push(e);
}
const e=events[0];
if(!e) throw new Error('smoke event missing');
const stiffnessScale=1.5;

// Stage 1: equivalent baseline ventilated-perfusion fraction.
let bestVpf=null;
const vpfCandidates=[];
for(const vpf of VPF){
  try{
    const s=createBerlinLiveHumModSession(sessionArgs(e,stiffnessScale,{
      initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
      patientMechanicsParams:mechanicsParams(stiffnessScale,1.0),
      patientVentilatedPerfusionFractionOverride:vpf,
    }));
    s.initialize();
    const snap=s.runFor(10);
    const po2=snap.systemic.gasExchange.pao2MmHg;
    const err=po2-e.pre.po2;
    const row={vpf,po2,error:err,objective:Math.abs(err)};
    vpfCandidates.push(row);
    if(!bestVpf||row.objective<bestVpf.objective) bestVpf=row;
  }catch(err){
    vpfCandidates.push({vpf,errorMessage:String(err.message||err)});
  }
}

// Stage 2: no override; fit structural perfusion burden q + current recruitment r0.
let best=null;
const candidates=[];
for(const q of Q){
  for(const r0 of R0){
    try{
      const s=createBerlinLiveHumModSession(sessionArgs(e,stiffnessScale,{
        initialRecruitmentState:{normal:1,recruitable:r0,consolidated:0},
        patientMechanicsParams:paramsWithRecruitablePerfusion(stiffnessScale,q),
      }));
      s.initialize();
      const pre=s.runFor(10);
      const prePo2=pre.systemic.gasExchange.pao2MmHg;
      s.setPEEP(e.vent.peep_after);
      const post=s.runFor(30);
      const postPo2=post.systemic.gasExchange.pao2MmHg;
      const preErr=prePo2-e.pre.po2;
      const postErr=postPo2-e.post.po2;
      const objective=sq(preErr/10)+sq(postErr/10);
      const row={
        q,r0,objective,prePo2,postPo2,preErr,postErr,
        postRecruitment:post.pulmonary.recentWaveform &&
          post.pulmonary.recentWaveform.length
          ? post.pulmonary.recentWaveform[post.pulmonary.recentWaveform.length-1].compartments
          : null
      };
      candidates.push(row);
      if(!best||objective<best.objective) best=row;
    }catch(err){
      candidates.push({q,r0,error:String(err.message||err)});
    }
  }
}

const out={
  event_id:e.event_id,
  target:{prePo2:e.pre.po2,postPo2:e.post.po2,peepBefore:e.vent.peep_before,peepAfter:e.vent.peep_after},
  stiffnessScale,
  bestEquivalentBaselineVpf:bestVpf,
  vpfCandidates,
  bestRecruitmentPhenotype:best,
  candidates
};
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({
  target:out.target,
  bestEquivalentBaselineVpf:bestVpf,
  bestRecruitmentPhenotype:best
}));
