'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {Simulation,PcAcController}=require('../../ards-twin-v1.0/src/simulation.js');
const {mechanicsParams}=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/controlled_recruitment_history_6.json';
const OUT='/Users/philipbernard/mimic-data/derived/recruitment_second_controlled_fit.json';

const STIFF=[1.5,2.0,2.5,3.0];
const SHIFT=[-8,-6,-4,-2,0];
const QREC=[0.05,0.10,0.15,0.20];
const QFIX=[0.05,0.10,0.15,0.20];

function clone(x){return JSON.parse(JSON.stringify(x));}
function sq(x){return x*x;}
function finite(x){return typeof x==='number'&&Number.isFinite(x);}

function mechanicsParamsWithThreshold(stiffness,shift){
  const p=clone(mechanicsParams(stiffness,1.0));
  const r=p.compartments.find(c=>c.id==='recruitable');
  r.recruitment.P_open=22+shift;
  r.recruitment.P_close=12+shift;
  return p;
}
function fullParams(stiffness,shift,qRec,qFix){
  const p=mechanicsParamsWithThreshold(stiffness,shift);
  const qNormal=1-qRec-qFix;
  if(!(qNormal>0)) throw new Error('invalid perfusion fractions');
  for(const c of p.compartments){
    if(c.id==='normal') c.perfusionFraction=qNormal;
    if(c.id==='recruitable') c.perfusionFraction=qRec;
    if(c.id==='consolidated') c.perfusionFraction=qFix;
  }
  return p;
}

const e=JSON.parse(fs.readFileSync(INPUT,'utf8')).find(x=>x.event_id==='RCR-35c83e803827');
if(!e) throw new Error('event missing');

// Stage 1: mechanics-only prefilter on VT before and after the PEEP step.
const mech=[];
for(const stiffness of STIFF){
  for(const shift of SHIFT){
    try{
      const sim=new Simulation({
        params:mechanicsParamsWithThreshold(stiffness,shift),
        controller:new PcAcController({
          fio2:e.vent.fio2_percent/100,
          peep:e.vent.peep_before,
          rr:e.vent.rr_set,
          pinsp:e.vent.pinsp,
          inspiratoryTime:e.vent.inspiratory_time_sec,
          inspiratoryPause:0,
        }),
        dt:0.002,trackGas:false,
        initialRecruitmentState:{normal:1,recruitable:1,consolidated:0},
      });
      sim.runFor(24);
      const preBreaths=sim.metrics().filter(b=>finite(b.VtInspired)&&b.VtInspired>0);
      const pre=preBreaths[preBreaths.length-1];
      if(!pre) continue;
      sim.setPEEP(e.vent.peep_after);
      sim.runFor(24);
      const allBreaths=sim.metrics().filter(b=>finite(b.VtInspired)&&b.VtInspired>0);
      const post=allBreaths[allBreaths.length-1];
      if(!post) continue;
      const preVt=pre.VtInspired*1000, postVt=post.VtInspired*1000;
      const obj=sq((preVt-e.pre.vt_observed_ml)/40)+sq((postVt-e.post.vt_observed_ml)/40);
      mech.push({stiffness,shift,preVt,postVt,mechanicsObjective:obj});
    }catch{}
  }
}
mech.sort((a,b)=>a.mechanicsObjective-b.mechanicsObjective);
const shortlisted=mech.slice(0,4);

// Stage 2: expensive gas fit only on shortlisted mechanics.
const rows=[];
let best=null;
for(const m of shortlisted){
  for(const qRec of QREC){
    for(const qFix of QFIX){
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
          initialRecruitmentState:{normal:1,recruitable:1,consolidated:0},
          patientMechanicsParams:fullParams(m.stiffness,m.shift,qRec,qFix),
          patientArterialGasInitialization:{
            po2MmHg:e.pre.po2,pco2MmHg:e.pre.pco2,pH:e.pre.ph,
          },
          dt:0.002,mechanicalWarmupSec:15,coupledEquilibrationSec:0,
        });
        s.initialize();
        const pre=s.runFor(8);
        const pb=pre.pulmonary.measurements.lastValidDeliveredBreath;
        if(!pb) continue;
        s.setPEEP(e.vent.peep_after);
        const post=s.runFor(16);
        const qb=post.pulmonary.measurements.lastValidDeliveredBreath;
        if(!qb) continue;

        const row={
          ...m,qRec,qFix,qNormal:1-qRec-qFix,
          prePo2:pre.systemic.gasExchange.pao2MmHg,
          postPo2:post.systemic.gasExchange.pao2MmHg,
          preVtMl:pb.VtInspired*1000,
          postVtMl:qb.VtInspired*1000,
          preVpf:pre.systemic.gasExchange.ventilatedPerfusionFraction,
          postVpf:post.systemic.gasExchange.ventilatedPerfusionFraction,
        };
        row.prePo2Err=row.prePo2-e.pre.po2;
        row.postPo2Err=row.postPo2-e.post.po2;
        row.preVtErr=row.preVtMl-e.pre.vt_observed_ml;
        row.postVtErr=row.postVtMl-e.post.vt_observed_ml;
        row.objective=
          sq(row.prePo2Err/10)+sq(row.postPo2Err/10)+
          sq(row.preVtErr/40)+sq(row.postVtErr/40);
        rows.push(row);
        if(!best||row.objective<best.objective) best=row;
      }catch{}
    }
  }
}
rows.sort((a,b)=>a.objective-b.objective);
const out={
  event_id:e.event_id,
  target:{
    peep:[e.vent.peep_before,e.vent.peep_after],
    prePo2:e.pre.po2,postPo2:e.post.po2,
    preVtMl:e.pre.vt_observed_ml,postVtMl:e.post.vt_observed_ml,
  },
  excluded_plateau_reason:'recorded plateau 17 cmH2O is below contemporaneous PEEP 20 cmH2O',
  mechanicsShortlist:shortlisted,
  best,top10:rows.slice(0,10),evaluated:rows.length
};
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out));
