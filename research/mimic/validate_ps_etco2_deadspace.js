'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { mechanicsParams }=require('./fit_controlled_mechanics.js');

const TARGETS='/Users/philipbernard/mimic-data/derived/ps_etco2_effort_targets.json';
const OUTDIR='/Users/philipbernard/mimic-data/derived';
const FRACTIONS=[0.05,0.10,0.20,0.30,0.40,0.50,0.60,0.70,0.80];

const targets=new Map(JSON.parse(fs.readFileSync(TARGETS,'utf8')).map(x=>[x.event_id,x]));
const fits=[];
for(let i=0;i<8;i++){
  const p=OUTDIR+'/ps_effort_fit_'+i+'.json';
  if(!fs.existsSync(p)) continue;
  const xs=JSON.parse(fs.readFileSync(p,'utf8'));
  for(const x of xs){
    if(!x.best) continue;
    if(x.best.objective>1.0) continue;
    if((x.best.model.asynchronyIndex||0)>0) continue;
    fits.push(x);
  }
}
fits.sort((a,b)=>a.event_id.localeCompare(b.event_id));

const idx=process.env.EVENT_INDEX==null?null:Number(process.env.EVENT_INDEX);
const selected=idx==null?fits:[fits[idx]];
const out=[];

for(const fit of selected){
  const e=targets.get(fit.event_id);
  let best=null;
  const candidates=[];
  for(const fraction of FRACTIONS){
    try{
      const session=createBerlinLiveHumModSession({
        caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
        ventilation:{
          mode:'PS',
          fio2:e.fio2/100,
          peep:e.peep,
          rr:2,
          pressureSupportCmH2O:e.psv,
        },
        initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
        patientStateProfile:'awake_cooperative',
        patientDriveRelativeOverride:fit.best.drive,
        patientMuscleTransmissionOverride:fit.best.muscleTransmission,
        patientMechanicsParams:mechanicsParams(fit.best.stiffnessScale,1.0),
        patientDeadSpaceFractionOfTidalVolume:fraction,
        patientArterialGasInitialization:{
          po2MmHg:e.po2,
          pco2MmHg:e.pco2,
          pH:e.ph,
        },
        dt:0.002,
        mechanicalWarmupSec:3,
        coupledEquilibrationSec:0,
      });
      session.initialize();
      const snap=session.runFor(20);
      const g=snap.systemic.gasExchange;
      const b=snap.pulmonary.measurements.lastCompletedBreath;
      const i=snap.patientVentilatorInteraction;
      if(!b) throw new Error('no completed breath');
      const effortTriggered=
        i.totalVentilatorBreaths>0 &&
        i.totalEfforts>=Math.max(1,0.8*i.totalVentilatorBreaths);
      const error=g.paco2MmHg-e.pco2;
      const objective=Math.abs(error);
      const row={
        fraction,objective,pco2Error:error,
        finalPco2:g.paco2MmHg,finalPo2:g.pao2MmHg,finalPH:g.pH,
        rr:b.RR,vtMl:b.VtInspired*1000,mv:b.MV,
        effortTriggered,
        asynchronyIndex:i.asynchronyIndex,
      };
      candidates.push(row);
      if(effortTriggered && Number.isFinite(objective) &&
         (!best||objective<best.objective)) best=row;
    }catch(err){
      candidates.push({fraction,error:String(err.message||err)});
    }
  }
  const row={
    event_id:e.event_id,
    quality:e.quality,
    measuredGradient:e.measured_gradient,
    effortFit:{
      drive:fit.best.drive,
      muscleTransmission:fit.best.muscleTransmission,
      stiffnessScale:fit.best.stiffnessScale,
      objective:fit.best.objective,
      muscleBoundary:fit.best.muscleTransmission===1.2,
    },
    target:{pco2:e.pco2,po2:e.po2,pH:e.ph,rr:e.rr_total,vtMl:e.vt_ml,mv:e.mv},
    best,candidates
  };
  out.push(row);
  console.log(JSON.stringify({
    event_id:e.event_id,
    measuredGradient:e.measured_gradient,
    bestFraction:best&&best.fraction,
    pco2Error:best&&best.pco2Error,
    effortObjective:fit.best.objective,
    muscleBoundary:fit.best.muscleTransmission===1.2
  }));
}

const suffix=idx==null?'all':String(idx);
fs.writeFileSync(OUTDIR+'/ps_etco2_deadspace_validation_'+suffix+'.json',
  JSON.stringify(out,null,2)+'\n');
