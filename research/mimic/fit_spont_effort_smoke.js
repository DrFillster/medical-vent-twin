'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {Simulation,PcAcController}=require('../../ards-twin-v1.0/src/simulation.js');
const {mechanicsParams}=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/spont_recruitment_history_7.json';
const OUT='/Users/philipbernard/mimic-data/derived/spont_effort_smoke_1.json';

const STIFF=[0.4,0.5,0.6,0.75,1.0,1.25,1.5,2.0];
const DRIVES=[0.10,0.15,0.20,0.25,0.30,0.35,0.45];
const MUSCLE=[0.0,0.2,0.4,0.6,0.8,1.0,1.2];

function sq(x){return x*x;}
function finite(x){return typeof x==='number'&&Number.isFinite(x);}

function modelCompliance(peep,stiffnessScale){
  const sim=new Simulation({
    params:mechanicsParams(stiffnessScale,1.0),
    controller:new PcAcController({
      fio2:0.4,peep,rr:10,pinsp:10,inspiratoryTime:1.0,inspiratoryPause:0
    }),
    dt:0.002,trackGas:false,
    initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
  });
  sim.runFor(30);
  const breaths=sim.metrics().filter(x=>finite(x.VtInspired)&&x.VtInspired>0);
  const b=breaths[breaths.length-1];
  return b ? b.VtInspired*1000/10 : null;
}

function runPs(e,drive,muscle,stiffness){
  const s=createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:{
      mode:'PS',
      fio2:e.vent.fio2_percent/100,
      peep:e.vent.peep_before,
      rr:2,
      pressureSupportCmH2O:e.vent.psv,
    },
    initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
    patientStateProfile:'awake_cooperative',
    patientDriveRelativeOverride:drive,
    patientMuscleTransmissionOverride:muscle,
    patientMechanicsParams:mechanicsParams(stiffness,1.0),
    dt:0.002,mechanicalWarmupSec:3,coupledEquilibrationSec:0,
  });
  s.initialize();
  const x=s.runFor(12);
  const b=x.pulmonary.measurements.lastCompletedBreath;
  const i=x.patientVentilatorInteraction;
  if(!b) throw new Error('no completed breath');
  const coupled=
    i.totalEfforts>0 && i.totalVentilatorBreaths>0 &&
    i.totalEfforts>=0.8*i.totalVentilatorBreaths &&
    i.totalVentilatorBreaths>=0.8*i.totalEfforts;
  return {
    coupled,
    rr:b.RR,vtMl:b.VtInspired*1000,mv:b.MV,
    efforts:i.totalEfforts,breaths:i.totalVentilatorBreaths,
    asynchronyIndex:i.asynchronyIndex
  };
}

const EVENT_INDEX=Number(process.env.EVENT_INDEX||0);
const e=JSON.parse(fs.readFileSync(INPUT,'utf8'))[EVENT_INDEX];

// Step 1: map documented compliance to stiffness.
let bestStiff=null;
const stiffRows=[];
for(const stiffness of STIFF){
  const c=modelCompliance(e.vent.peep_before,stiffness);
  if(!finite(c)) continue;
  const err=Math.abs(c-e.pre.compliance);
  const row={stiffness,modelCompliance:c,absError:err,relativeError:err/e.pre.compliance};
  stiffRows.push(row);
  if(!bestStiff||err<bestStiff.absError) bestStiff=row;
}

// Step 2: timing from RR only with neutral muscle transmission.
let bestDrive=null;
const driveRows=[];
for(const drive of DRIVES){
  try{
    const m=runPs(e,drive,1.0,bestStiff.stiffness);
    if(!m.coupled) continue;
    const obj=sq((m.rr-e.pre.rr)/Math.max(2,0.10*e.pre.rr));
    const row={drive,objective:obj,model:m};
    driveRows.push(row);
    if(!bestDrive||obj<bestDrive.objective) bestDrive=row;
  }catch{}
}

// Step 3: amplitude from VT/MV with drive + stiffness frozen.
let bestMuscle=null;
const muscleRows=[];
for(const muscle of MUSCLE){
  try{
    const m=runPs(e,bestDrive.drive,muscle,bestStiff.stiffness);
    if(!m.coupled) continue;
    const obj=(
      sq((m.rr-e.pre.rr)/Math.max(2,0.10*e.pre.rr))+
      sq((m.vtMl-e.pre.vt_ml)/Math.max(75,0.15*e.pre.vt_ml))+
      sq((m.mv-e.pre.mv)/Math.max(1,0.15*e.pre.mv))
    )/3;
    const row={muscle,objective:obj,model:m};
    muscleRows.push(row);
    if(!bestMuscle||obj<bestMuscle.objective) bestMuscle=row;
  }catch{}
}

const out={
  event_id:e.event_id,
  target:e,
  bestStiffness:bestStiff,
  bestDrive,
  bestMuscle,
  stiffRows,driveRows,muscleRows
};
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({
  event_id:e.event_id,
  target:{rr:e.pre.rr,vtMl:e.pre.vt_ml,mv:e.pre.mv,compliance:e.pre.compliance},
  stiffness:bestStiff,
  drive:bestDrive,
  muscle:bestMuscle
}));
