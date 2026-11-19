'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {mechanicsParams}=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/spont_recruitment_history_7.json';
const OUT='/Users/philipbernard/mimic-data/derived/spont_recruitment_tight_fit.json';

const DRIVE=0.45;
const MUSCLE=1.0;
const STIFFNESS=0.75;

const R0=[0.4,0.6,0.8,1.0];
const SHIFT=[-8,-6,-4,-2,0];
const QREC=[0.05,0.10,0.15];
const QFIX=[0.05,0.10,0.15];

function clone(x){return JSON.parse(JSON.stringify(x));}
function sq(x){return x*x;}

function paramsWithRecruitment(shift,qRec=null,qFix=null){
  const p=clone(mechanicsParams(STIFFNESS,1.0));
  const r=p.compartments.find(c=>c.id==='recruitable');
  r.recruitment.P_open=22+shift;
  r.recruitment.P_close=12+shift;
  if(qRec!=null&&qFix!=null){
    const qNormal=1-qRec-qFix;
    p.compartments.find(c=>c.id==='normal').perfusionFraction=qNormal;
    r.perfusionFraction=qRec;
    p.compartments.find(c=>c.id==='consolidated').perfusionFraction=qFix;
  }
  return p;
}

function makeSession(e,{r0,shift,qRec=null,qFix=null,gas=false}){
  return createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:{
      mode:'PS',
      fio2:e.vent.fio2_percent/100,
      peep:e.vent.peep_before,
      rr:2,
      pressureSupportCmH2O:e.vent.psv,
    },
    initialRecruitmentState:{normal:1,recruitable:r0,consolidated:0},
    patientStateProfile:'awake_cooperative',
    patientDriveRelativeOverride:DRIVE,
    patientMuscleTransmissionOverride:MUSCLE,
    patientMechanicsParams:paramsWithRecruitment(shift,qRec,qFix),
    ...(gas?{patientArterialGasInitialization:{
      po2MmHg:e.pre.po2,pco2MmHg:e.pre.pco2,pH:e.pre.ph,
    }}:{}),
    dt:0.002,mechanicalWarmupSec:3,coupledEquilibrationSec:0,
  });
}

const e=JSON.parse(fs.readFileSync(INPUT,'utf8'))[2];

// Mechanics/effort shortlist.
const mech=[];
for(const r0 of R0){
  for(const shift of SHIFT){
    try{
      const s=makeSession(e,{r0,shift,gas:false});
      s.initialize();
      const pre=s.runFor(12);
      const pb=pre.pulmonary.measurements.lastCompletedBreath;
      const pi=pre.patientVentilatorInteraction;
      if(!pb||!pi.totalEfforts||!pi.totalVentilatorBreaths) continue;
      s.setPEEP(e.vent.peep_after);
      const post=s.runFor(30);
      const qb=post.pulmonary.measurements.lastCompletedBreath;
      const qi=post.patientVentilatorInteraction;
      if(!qb||!qi.totalEfforts||!qi.totalVentilatorBreaths) continue;
      const coupled=
        pi.totalEfforts>=0.8*pi.totalVentilatorBreaths &&
        pi.totalVentilatorBreaths>=0.8*pi.totalEfforts &&
        qi.totalEfforts>=0.8*qi.totalVentilatorBreaths &&
        qi.totalVentilatorBreaths>=0.8*qi.totalEfforts;
      if(!coupled) continue;
      const row={
        r0,shift,
        preRr:pb.RR,preVtMl:pb.VtInspired*1000,preMv:pb.MV,
        postRr:qb.RR,postVtMl:qb.VtInspired*1000,postMv:qb.MV,
      };
      row.mechanicsObjective=(
        sq((row.preRr-e.pre.rr)/Math.max(2,.1*e.pre.rr))+
        sq((row.preVtMl-e.pre.vt_ml)/Math.max(75,.15*e.pre.vt_ml))+
        sq((row.preMv-e.pre.mv)/Math.max(1,.15*e.pre.mv))+
        sq((row.postVtMl-e.post.vt_ml)/Math.max(75,.15*e.post.vt_ml))+
        sq((row.postMv-e.post.mv)/Math.max(1,.15*e.post.mv))
      )/5;
      mech.push(row);
    }catch{}
  }
}
mech.sort((a,b)=>a.mechanicsObjective-b.mechanicsObjective);
const shortlisted=mech.slice(0,3);

// Gas fit; longer post stabilization for 52-minute observed window.
const rows=[];
let best=null;
for(const m of shortlisted){
  for(const qRec of QREC){
    for(const qFix of QFIX){
      try{
        const s=makeSession(e,{r0:m.r0,shift:m.shift,qRec,qFix,gas:true});
        s.initialize();
        const pre=s.runFor(12);
        const pb=pre.pulmonary.measurements.lastCompletedBreath;
        s.setPEEP(e.vent.peep_after);
        const post=s.runFor(60);
        const qb=post.pulmonary.measurements.lastCompletedBreath;
        if(!pb||!qb) continue;
        const row={
          ...m,qRec,qFix,qNormal:1-qRec-qFix,
          prePo2:pre.systemic.gasExchange.pao2MmHg,
          postPo2:post.systemic.gasExchange.pao2MmHg,
          preVpf:pre.systemic.gasExchange.ventilatedPerfusionFraction,
          postVpf:post.systemic.gasExchange.ventilatedPerfusionFraction,
          preVtMlGas:pb.VtInspired*1000,
          postVtMlGas:qb.VtInspired*1000,
        };
        row.prePo2Err=row.prePo2-e.pre.po2;
        row.postPo2Err=row.postPo2-e.post.po2;
        row.objective=
          m.mechanicsObjective+
          sq(row.prePo2Err/10)+
          sq(row.postPo2Err/10);
        rows.push(row);
        if(!best||row.objective<best.objective) best=row;
      }catch{}
    }
  }
}
rows.sort((a,b)=>a.objective-b.objective);
const out={
  event_id:e.event_id,
  fixedEffort:{drive:DRIVE,muscle:MUSCLE,stiffness:STIFFNESS},
  abgTimingMinutes:{preBefore:24,postAfter:52},
  target:{
    peep:[e.vent.peep_before,e.vent.peep_after],
    pre:{rr:e.pre.rr,vtMl:e.pre.vt_ml,mv:e.pre.mv,po2:e.pre.po2},
    post:{vtMl:e.post.vt_ml,mv:e.post.mv,po2:e.post.po2},
  },
  mechanicsShortlist:shortlisted,
  best,top10:rows.slice(0,10),evaluated:rows.length
};
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out));
