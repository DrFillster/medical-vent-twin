'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { mechanicsParams }=require('./fit_controlled_mechanics.js');

const TARGETS='/Users/philipbernard/mimic-data/derived/ps_etco2_effort_targets.json';
const OUTDIR='/Users/philipbernard/mimic-data/derived';
const PERF=[0.50,0.60,0.70,0.80,0.90,0.95,1.00];

const targets=new Map(JSON.parse(fs.readFileSync(TARGETS,'utf8')).map(x=>[x.event_id,x]));
const fits=[];
for(let i=0;i<8;i++){
  const p=OUTDIR+'/ps_effort_fit_'+i+'.json';
  if(!fs.existsSync(p)) continue;
  for(const x of JSON.parse(fs.readFileSync(p,'utf8'))){
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
  for(const perfusionFraction of PERF){
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
        patientVentilatedPerfusionFractionOverride:perfusionFraction,
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
      const po2Error=g.pao2MmHg-e.po2;
      const pco2Error=g.paco2MmHg-e.pco2;
      const row={
        perfusionFraction,
        objective:Math.abs(po2Error),
        po2Error,
        pco2Error,
        finalPo2:g.pao2MmHg,
        finalPco2:g.paco2MmHg,
        finalPH:g.pH
      };
      candidates.push(row);
      if(!best||row.objective<best.objective) best=row;
    }catch(err){
      candidates.push({perfusionFraction,error:String(err.message||err)});
    }
  }
  const row={
    event_id:e.event_id,
    measuredDeadSpaceGradient:e.measured_gradient,
    effortObjective:fit.best.objective,
    target:{po2:e.po2,pco2:e.pco2,pH:e.ph},
    best,candidates
  };
  out.push(row);
  console.log(JSON.stringify({
    event_id:e.event_id,
    targetPo2:e.po2,
    bestPerfusion:best&&best.perfusionFraction,
    po2Error:best&&best.po2Error,
    pco2Error:best&&best.pco2Error
  }));
}
const suffix=idx==null?'all':String(idx);
fs.writeFileSync(OUTDIR+'/ps_oxygenation_fit_'+suffix+'.json',
  JSON.stringify(out,null,2)+'\n');
