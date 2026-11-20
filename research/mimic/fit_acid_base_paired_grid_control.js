'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { mechanicsParams }=require('./fit_controlled_mechanics.js');

const BASE='/Users/philipbernard/mimic-data/derived';
const PREFIT=BASE+'/primary60_conservative_prefit.json';
const REFIT=BASE+'/primary60_ps_fio2_composite_refit.jsonl';
const OUT=BASE+'/acid_base_paired_grid_control.json';

const IDS=[
  'FIT-05c54056e1c9',
  'FIT-37d46fb4de8b',
  'FIT-66b775dbbe1f',
  'FIT-102b833418f3',
];
const CO2=[0.10,0.25,0.40,0.55,0.70,0.82];
const VPF=[0.50,0.60,0.70,0.80,0.85,0.90,0.95,1.00];

function loadJsonl(p){
  return fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
}
function sq(x){return x*x;}
const prefit=new Map(JSON.parse(fs.readFileSync(PREFIT,'utf8')).map(x=>[x.event_id,x]));
const prior=new Map(loadJsonl(REFIT).map(x=>[x.event_id,x]));

function sessionFor(e,{sid,co2=0.40,vpf=0.85}){
  const p=e.prefit,v=e.vent;
  return createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:{
      mode:'PS',fio2:v.fio2_percent/100,peep:v.peep,rr:2,
      pressureSupportCmH2O:v.psv,
    },
    initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
    patientStateProfile:'awake_cooperative',
    patientDriveRelativeOverride:p.drive,
    patientMuscleTransmissionOverride:p.muscle_transmission,
    patientMechanicsParams:mechanicsParams(p.stiffness_scale,p.resistance_scale),
    patientDeadSpaceFractionOfTidalVolume:co2,
    patientVentilatedPerfusionFractionOverride:vpf,
    patientBloodSidMolPerL:sid,
    patientArterialGasInitialization:{
      po2MmHg:e.targets.po2,pco2MmHg:e.targets.pco2,pH:e.targets.ph,
    },
    dt:0.010,mechanicalWarmupSec:8,coupledEquilibrationSec:0,
    physicianValidationCandidate:false,
  });
}

function initializedPH(e,sid){
  const s=sessionFor(e,{sid});
  const x=s.initialize();
  return x.coupling.patientGasInitializationDiagnostics.initializedPH;
}

function fitSid(e){
  let lo=0.005,hi=0.100;
  const target=e.targets.ph;
  const plo=initializedPH(e,lo),phi=initializedPH(e,hi);
  const increasing=phi>plo;
  if(target<Math.min(plo,phi)||target>Math.max(plo,phi)){
    return null;
  }
  let best=null;
  for(let i=0;i<36;i++){
    const mid=(lo+hi)/2,ph=initializedPH(e,mid),err=ph-target;
    if(!best||Math.abs(err)<Math.abs(best.error)) best={sid:mid,initializedPH:ph,error:err};
    if(Math.abs(err)<1e-6) break;
    if(increasing){ if(ph<target) lo=mid; else hi=mid; }
    else { if(ph>target) lo=mid; else hi=mid; }
  }
  return best;
}

function run(e,pars,totalSec){
  const s=sessionFor(e,pars);
  s.initialize();
  const baseline=s.runFor(24);
  let elapsed=24;
  while(elapsed<totalSec){
    const step=Math.min(30,totalSec-elapsed);
    s.runFor(step); s.compactTraceHistory(60); elapsed+=step;
  }
  const final=s.snapshot();
  return {
    baseline:{
      po2:baseline.systemic.gasExchange.pao2MmHg,
      pco2:baseline.systemic.gasExchange.paco2MmHg,
      pH:baseline.systemic.gasExchange.pH,
    },
    final:{
      po2:final.systemic.gasExchange.pao2MmHg,
      pco2:final.systemic.gasExchange.paco2MmHg,
      pH:final.systemic.gasExchange.pH,
    }
  };
}


// Development diagnostic only. No production or locked-fit changes.
// Search both coupled nuisance parameters with the same combined objective.
function objective(r,t){
  const terms=[
    (r.baseline.pco2-t.pco2)/8,(r.final.pco2-t.pco2)/8,
    (r.baseline.po2-t.po2)/20,(r.final.po2-t.po2)/20,
    (r.baseline.pH-t.ph)/0.10,(r.final.pH-t.ph)/0.10,
  ];
  if(!terms.every(Number.isFinite)) throw new Error('nonfinite objective');
  return terms.reduce((a,b)=>a+b*b,0);
}
function summarize(r,t){
  const residuals={
    baseline_pco2:r.baseline.pco2-t.pco2,
    baseline_po2:r.baseline.po2-t.po2,
    baseline_ph:r.baseline.pH-t.ph,
    drift_pco2_60:r.final.pco2-r.baseline.pco2,
    drift_po2_60:r.final.po2-r.baseline.po2,
    drift_ph_60:r.final.pH-r.baseline.pH,
    final_ph:r.final.pH-t.ph,
  };
  return {residuals,pass:Math.abs(residuals.baseline_pco2)<=8 &&
    Math.abs(residuals.baseline_po2)<=20 &&
    Math.abs(residuals.drift_pco2_60)<=8 &&
    Math.abs(residuals.drift_po2_60)<=20};
}
const id='FIT-102b833418f3';
const e=prefit.get(id),old=prior.get(id);
if(!e||!old||old.pass!==true) throw new Error('missing prior passing control');
const sidFit=fitSid(e);
if(!sidFit) throw new Error('SID fit failed');
const oldPars={sid:0.040,
  co2:old.fitted.effective_co2_elimination_fraction,
  vpf:old.fitted.effective_ventilated_perfusion_fraction};
const defaultReplay=summarize(run(e,oldPars,3600),e.targets);
console.log('default control replay pass='+defaultReplay.pass);
if(!defaultReplay.pass) throw new Error('prior passing control not reproduced; stop');
let best=null,attempted=0,failed=0;
const failures=[];
for(const co2 of CO2){
  for(const vpf of VPF){
    attempted++;
    try{
      const pars={sid:sidFit.sid,co2,vpf};
      const r=run(e,pars,900),score=objective(r,e.targets);
      if(!best||score<best.score) best={pars,score};
    }catch(err){failed++;failures.push({co2,vpf,error:err.message});}
  }
  console.log('paired grid attempted='+attempted+' failed='+failed);
}
if(!best) throw new Error('all paired candidates failed');
const confirmation=summarize(run(e,best.pars,3600),e.targets);
const result={status:'development-diagnostic-complete',event_id:id,
  defaultReplay,attempted,failed,failures,best,confirmation,
  provenance:{post_index_data_loaded:false,
    input_files:[PREFIT,REFIT],
    search_horizon_sec:900,confirmation_horizon_sec:3600,
    same_co2_and_vpf_grid_as_previous_smoke:true,
    combined_objective_includes_both_gases_and_ph:true,
    ph_scale:0.10,ph_scale_is_development_weight_not_clinical_threshold:true,
    historical_gas_gate_unchanged:true,
    ph_remains_separate_diagnostic_not_new_acceptance_gate:true,
    sid_is_latent_not_measured:true,production_changed:false}};
fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:result.status,default_pass:defaultReplay.pass,
  paired_pass:confirmation.pass,attempted,failed,
  residuals:confirmation.residuals}));
