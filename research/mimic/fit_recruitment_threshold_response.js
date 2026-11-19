'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {mechanicsParams}=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/controlled_recruitment_history_6.json';
const OUT='/Users/philipbernard/mimic-data/derived/recruitment_threshold_response_fit.json';

const Q=[0.30,0.35,0.40];
const SHIFTS=[-6,-4,-2];

function clone(x){return JSON.parse(JSON.stringify(x));}
function sq(x){return x*x;}

function params(q,shift){
  const p=clone(mechanicsParams(2.0,1.0));
  const non=1-q;
  for(const c of p.compartments){
    if(c.id==='recruitable'){
      c.perfusionFraction=q;
      c.recruitment.P_open=22+shift;
      c.recruitment.P_close=12+shift;
    }
    if(c.id==='normal') c.perfusionFraction=non*(0.55/0.70);
    if(c.id==='consolidated') c.perfusionFraction=non*(0.15/0.70);
  }
  return p;
}

const e=JSON.parse(fs.readFileSync(INPUT,'utf8')).find(x=>x.event_id==='RCR-3c238f0dd76b');
if(!e) throw new Error('event missing');

const rows=[];
let best=null;
for(const q of Q){
  for(const shift of SHIFTS){
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
        patientMechanicsParams:params(q,shift),
        patientArterialGasInitialization:{
          po2MmHg:e.pre.po2,pco2MmHg:e.pre.pco2,pH:e.pre.ph,
        },
        dt:0.002,mechanicalWarmupSec:12.5,coupledEquilibrationSec:0,
      });
      s.initialize();
      const pre=s.runFor(10);
      const pb=pre.pulmonary.measurements.lastValidDeliveredBreath;
      s.setPEEP(e.vent.peep_after);
      const post=s.runFor(30);
      const qb=post.pulmonary.measurements.lastValidDeliveredBreath;
      const row={
        q,shift,
        prePo2:pre.systemic.gasExchange.pao2MmHg,
        postPo2:post.systemic.gasExchange.pao2MmHg,
        preVtMl:pb&&pb.VtInspired*1000,
        postVtMl:qb&&qb.VtInspired*1000,
        preVpf:pre.systemic.gasExchange.ventilatedPerfusionFraction,
        postVpf:post.systemic.gasExchange.ventilatedPerfusionFraction,
      };
      row.prePo2Err=row.prePo2-e.pre.po2;
      row.postPo2Err=row.postPo2-e.post.po2;
      row.preVtErr=row.preVtMl-e.pre.vt_observed_ml;
      row.postVtErr=row.postVtMl-e.post.vt_observed_ml;
      row.objective=
        sq(row.prePo2Err/10)+sq(row.postPo2Err/10)+
        sq(row.preVtErr/50)+sq(row.postVtErr/50);
      rows.push(row);
      if(!best||row.objective<best.objective) best=row;
    }catch(err){
      rows.push({q,shift,error:String(err.message||err)});
    }
  }
}
const out={event_id:e.event_id,target:{prePo2:e.pre.po2,postPo2:e.post.po2,preVtMl:e.pre.vt_observed_ml,postVtMl:e.post.vt_observed_ml},best,rows};
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out));
