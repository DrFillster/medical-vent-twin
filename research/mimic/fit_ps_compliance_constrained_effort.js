'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {mechanicsParams}=require('./fit_controlled_mechanics.js');

const TARGETS='/Users/philipbernard/mimic-data/derived/ps_etco2_effort_targets.json';
const MAP='/Users/philipbernard/mimic-data/derived/ps_compliance_stiffness_map.json';
const FITS=[
  '/Users/philipbernard/mimic-data/derived/ps_two_axis_fit_0_3.json',
  '/Users/philipbernard/mimic-data/derived/ps_two_axis_fit_4_7.json'
];
const OUT='/Users/philipbernard/mimic-data/derived/ps_compliance_constrained_effort.json';

const MUSCLE=[0.0,0.2,0.4,0.6,0.8,1.0,1.2];
function sq(x){return x*x;}
function finite(x){return typeof x==='number'&&Number.isFinite(x);}

const targets=new Map(JSON.parse(fs.readFileSync(TARGETS,'utf8')).map(x=>[x.event_id,x]));
const stiffnessMap=new Map(JSON.parse(fs.readFileSync(MAP,'utf8')).map(x=>[x.event_id,x]));
const oldFits=new Map(FITS.flatMap(p=>JSON.parse(fs.readFileSync(p,'utf8'))).map(x=>[x.event_id,x]));

function runCandidate(e,drive,muscleTransmission,stiffnessScale){
  const session=createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:{
      mode:'PS',fio2:e.fio2/100,peep:e.peep,rr:2,
      pressureSupportCmH2O:e.psv,
    },
    initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
    patientStateProfile:'awake_cooperative',
    patientDriveRelativeOverride:drive,
    patientMuscleTransmissionOverride:muscleTransmission,
    patientMechanicsParams:mechanicsParams(stiffnessScale,1.0),
    dt:0.002,mechanicalWarmupSec:3,coupledEquilibrationSec:0,
  });
  session.initialize();
  const snap=session.runFor(10);
  const b=snap.pulmonary.measurements.lastCompletedBreath;
  const i=snap.patientVentilatorInteraction;
  if(!b) throw new Error('no completed breath');
  return {
    patientTriggered:i.totalVentilatorBreaths>0 && i.totalEfforts>0 &&
      i.totalEfforts>=Math.max(1,0.8*i.totalVentilatorBreaths) &&
      i.totalVentilatorBreaths>=Math.max(1,0.8*i.totalEfforts),
    rr:b.RR,vtMl:b.VtInspired*1000,mv:b.MV,
    asynchronyIndex:i.asynchronyIndex,
    totalEfforts:i.totalEfforts,totalVentilatorBreaths:i.totalVentilatorBreaths
  };
}

const results=[];
for(const [event_id,mapRow] of stiffnessMap){
  const e=targets.get(event_id);
  const old=oldFits.get(event_id);
  if(!e||!old||!mapRow.best) continue;
  const drive=old.bestDrive;
  const stiffnessScale=mapRow.best.stiffnessScale;
  let best=null;
  const candidates=[];
  for(const muscle of MUSCLE){
    try{
      const m=runCandidate(e,drive,muscle,stiffnessScale);
      if(!m.patientTriggered){
        candidates.push({muscle,rejected:'backup_or_no_effort',model:m});
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
      const row={muscle,objective:obj,model:m};
      candidates.push(row);
      if(Number.isFinite(obj)&&(!best||obj<best.objective)) best=row;
    }catch(err){
      candidates.push({muscle,error:String(err.message||err)});
    }
  }
  const row={
    event_id,quality:e.quality,measuredGradient:e.measured_gradient,
    drive,stiffnessScale,
    targetCompliance:e.compliance_doc,
    modeledPassiveCompliance:mapRow.best.modelCompliance,
    complianceRelativeError:mapRow.best.relativeError,
    best,candidates,
    target:{rr:e.rr_total,vtMl:e.vt_ml,mv:e.mv}
  };
  results.push(row);
  console.log(JSON.stringify({
    event_id,drive,stiffnessScale,
    targetCompliance:e.compliance_doc,
    muscle:best&&best.muscle,
    objective:best&&best.objective,
    model:best&&best.model,
    target:row.target
  }));
}
fs.writeFileSync(OUT,JSON.stringify(results,null,2)+'\n');
