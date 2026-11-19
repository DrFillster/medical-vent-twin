'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {mechanicsParams}=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/controlled_recruitment_history_6.json';
const OUT='/Users/philipbernard/mimic-data/derived/recruitment_structural_smoke_refined.json';

const TARGET_VPF=0.84;
const Q=[0.10,0.20,0.30,0.40,0.50,0.60,0.70,0.80,0.90];
const R0=[0.50,0.60,0.70,0.80,0.90,1.00];

function clone(x){return JSON.parse(JSON.stringify(x));}
function sq(x){return x*x;}

function impliedVpf(q,r0){
  const normal=(1-q)*(0.55/0.70);
  return normal + q*r0;
}

function paramsWithRecruitablePerfusion(stiffnessScale,q){
  const p=clone(mechanicsParams(stiffnessScale,1.0));
  const non=1-q;
  for(const c of p.compartments){
    if(c.id==='recruitable') c.perfusionFraction=q;
    if(c.id==='normal') c.perfusionFraction=non*(0.55/0.70);
    if(c.id==='consolidated') c.perfusionFraction=non*(0.15/0.70);
  }
  return p;
}

const raw=JSON.parse(fs.readFileSync(INPUT,'utf8'));
const e=raw.find(x=>x.event_id==='RCR-3c238f0dd76b');
if(!e) throw new Error('event missing');
const stiffnessScale=1.5;

const candidates=[];
let best=null;
for(const q of Q){
  for(const r0 of R0){
    const baselineVpf=impliedVpf(q,r0);
    if(Math.abs(baselineVpf-TARGET_VPF)>0.035) continue;
    try{
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
        patientMechanicsParams:paramsWithRecruitablePerfusion(stiffnessScale,q),
        patientArterialGasInitialization:{
          po2MmHg:e.pre.po2,pco2MmHg:e.pre.pco2,pH:e.pre.ph,
        },
        dt:0.002,mechanicalWarmupSec:3,coupledEquilibrationSec:0,
      });
      s.initialize();
      const pre=s.runFor(10);
      const prePo2=pre.systemic.gasExchange.pao2MmHg;
      s.setPEEP(e.vent.peep_after);
      const post=s.runFor(30);
      const postPo2=post.systemic.gasExchange.pao2MmHg;
      const preErr=prePo2-e.pre.po2;
      const postErr=postPo2-e.post.po2;
      const row={
        q,r0,baselineVpf,prePo2,postPo2,preErr,postErr,
        objective:sq(preErr/10)+sq(postErr/10),
        finalPatientState:post.patientState,
      };
      candidates.push(row);
      if(Math.abs(preErr)<=10 && (!best||row.objective<best.objective)) best=row;
    }catch(err){
      candidates.push({q,r0,baselineVpf,error:String(err.message||err)});
    }
  }
}

const out={
  event_id:e.event_id,
  target:{prePo2:e.pre.po2,postPo2:e.post.po2,peepBefore:e.vent.peep_before,peepAfter:e.vent.peep_after},
  targetBaselineVpf:TARGET_VPF,
  stiffnessScale,
  best,
  candidates
};
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out));
