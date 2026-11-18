'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { mechanicsParams }=require('./fit_controlled_mechanics.js');

const TARGETS='/Users/philipbernard/mimic-data/derived/ps_etco2_effort_targets.json';
const OUTDIR='/Users/philipbernard/mimic-data/derived';
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

const results=[];
for(const fit of fits){
  const e=targets.get(fit.event_id);
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
      patientDeadSpaceFractionOfTidalVolume:e.measured_gradient,
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
    const row={
      event_id:e.event_id,
      measuredGradient:e.measured_gradient,
      targetPco2:e.pco2,
      finalPco2:g.paco2MmHg,
      pco2Error:g.paco2MmHg-e.pco2,
      targetPo2:e.po2,
      finalPo2:g.pao2MmHg,
      po2Error:g.pao2MmHg-e.po2,
      targetPH:e.ph,
      finalPH:g.pH,
      phError:g.pH-e.ph,
      rr:b?b.RR:null,
      vtMl:b?b.VtInspired*1000:null,
      mv:b?b.MV:null,
      effortObjective:fit.best.objective,
      muscleBoundary:fit.best.muscleTransmission===1.2,
    };
    results.push(row);
    console.log(JSON.stringify(row));
  }catch(err){
    results.push({event_id:e.event_id,error:String(err.message||err)});
  }
}
fs.writeFileSync(OUTDIR+'/ps_measured_deadspace_direct_test.json',
  JSON.stringify(results,null,2)+'\n');
