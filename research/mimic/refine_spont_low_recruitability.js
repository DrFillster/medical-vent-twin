'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {mechanicsParams}=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/spont_recruitment_history_7.json';
const OUT='/Users/philipbernard/mimic-data/derived/spont_low_recruitability_refine.json';

const DRIVE=0.45, MUSCLE=1.0, STIFFNESS=0.75;
const R0=0.6, SHIFT=0;
const QREC=[0.0,0.025,0.05];
const QFIX=[0.0,0.025,0.05];

function clone(x){return JSON.parse(JSON.stringify(x));}
function sq(x){return x*x;}

function params(qRec,qFix){
  const p=clone(mechanicsParams(STIFFNESS,1.0));
  const qNormal=1-qRec-qFix;
  const r=p.compartments.find(c=>c.id==='recruitable');
  r.recruitment.P_open=22+SHIFT;
  r.recruitment.P_close=12+SHIFT;
  p.compartments.find(c=>c.id==='normal').perfusionFraction=qNormal;
  r.perfusionFraction=qRec;
  p.compartments.find(c=>c.id==='consolidated').perfusionFraction=qFix;
  return p;
}

const e=JSON.parse(fs.readFileSync(INPUT,'utf8'))[2];
const rows=[]; let best=null;
for(const qRec of QREC){
  for(const qFix of QFIX){
    try{
      const s=createBerlinLiveHumModSession({
        caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
        ventilation:{
          mode:'PS',fio2:e.vent.fio2_percent/100,peep:e.vent.peep_before,
          rr:2,pressureSupportCmH2O:e.vent.psv,
        },
        initialRecruitmentState:{normal:1,recruitable:R0,consolidated:0},
        patientStateProfile:'awake_cooperative',
        patientDriveRelativeOverride:DRIVE,
        patientMuscleTransmissionOverride:MUSCLE,
        patientMechanicsParams:params(qRec,qFix),
        patientArterialGasInitialization:{
          po2MmHg:e.pre.po2,pco2MmHg:e.pre.pco2,pH:e.pre.ph,
        },
        dt:0.002,mechanicalWarmupSec:3,coupledEquilibrationSec:0,
      });
      s.initialize();
      const pre=s.runFor(12);
      s.setPEEP(e.vent.peep_after);
      const post=s.runFor(60);
      const row={
        qRec,qFix,qNormal:1-qRec-qFix,
        prePo2:pre.systemic.gasExchange.pao2MmHg,
        postPo2:post.systemic.gasExchange.pao2MmHg,
        preVpf:pre.systemic.gasExchange.ventilatedPerfusionFraction,
        postVpf:post.systemic.gasExchange.ventilatedPerfusionFraction,
      };
      row.preErr=row.prePo2-e.pre.po2;
      row.postErr=row.postPo2-e.post.po2;
      row.objective=sq(row.preErr/10)+sq(row.postErr/10);
      rows.push(row);
      if(!best||row.objective<best.objective) best=row;
    }catch(err){
      rows.push({qRec,qFix,error:String(err.message||err)});
    }
  }
}
const out={event_id:e.event_id,target:{prePo2:e.pre.po2,postPo2:e.post.po2},best,rows};
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out));
