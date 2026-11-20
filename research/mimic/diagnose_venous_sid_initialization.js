'use strict';
// Process-local initializer substitution; never edits the production module.
const assert=require('assert');
const initPath=require.resolve('../../ards-twin-v1.0/src/patient_gas_initialization.js');
const original=require(initPath);
const {deriveBloodGasOutputs}=require('../../ards-twin-v1.0/src/hummod_ards_core_runtime.js');
const {pco2FromHco3Sid}=require('../../ards-twin-v1.0/src/hummod_ards_core_chemistry.js');
let preserveSourceVenousPco2=false;
let substitutions=0;
require.cache[initPath].exports={...original,createPatientArterialGasInitialState(args){
  const out=original.createPatientArterialGasInitialState(args);
  if(!preserveSourceVenousPco2) return out;
  const sourcePco2=deriveBloodGasOutputs({state:out.state,blood:{...args.blood,sidMolPerL:0.040}}).venous.pco2MmHg;
  // Invert the actual affine BaseToGas mapping, not the separately rounded
  // GasToBase mapping. Positive branch probes avoid its low-PCO2 clamp.
  const sid=args.blood.sidMolPerL;
  const x0=2*sid,x1=3*sid;
  const y0=pco2FromHco3Sid({hco3MolPerL:x0,sidMolPerL:sid}).pco2MmHg;
  const y1=pco2FromHco3Sid({hco3MolPerL:x1,sidMolPerL:sid}).pco2MmHg;
  assert(y1>y0 && y0>0.0001,'inverse probes clamped or nonmonotone');
  const venousHco3MolPerL=x0+(sourcePco2-y0)*(x1-x0)/(y1-y0);
  const state=Object.freeze({...out.state,venousHco3MolPerL});
  const check=deriveBloodGasOutputs({state,blood:args.blood}).venous.pco2MmHg;
  assert(Math.abs(check-sourcePco2)<0.001,'venous PCO2 round-trip failed');
  assert.strictEqual(state.arterialHco3MolPerL,out.state.arterialHco3MolPerL);
  assert.strictEqual(state.arterialO2ContentMlPerMl,out.state.arterialO2ContentMlPerMl);
  assert.strictEqual(state.venousO2ContentMlPerMl,out.state.venousO2ContentMlPerMl);
  if(args.blood.sidMolPerL===0.040) assert(Math.abs(state.venousHco3MolPerL-out.state.venousHco3MolPerL)<1e-8);
  substitutions++;
  return Object.freeze({...out,state});
}};

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
const OUT=BASE+'/venous_sid_initialization_control.json';

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


const e=prefit.get('FIT-102b833418f3');
const old=prior.get(e.event_id);
const paired=JSON.parse(fs.readFileSync(BASE+'/acid_base_paired_grid_control.json','utf8'));
const fixed={co2:old.fitted.effective_co2_elimination_fraction,vpf:old.fitted.effective_ventilated_perfusion_fraction};
const sidFit=fitSid(e);
if(!sidFit) throw new Error('SID fit failed');
const rows=[];
for(const config of [
  {label:'default_sid_original_nuisance',pars:{...fixed,sid:0.040}},
  {label:'latent_sid_original_nuisance',pars:{...fixed,sid:sidFit.sid}},
  {label:'latent_sid_paired_nuisance',pars:paired.best.pars},
]){
  for(const transformed of [false,true]){
    preserveSourceVenousPco2=transformed;
    const r=run(e,config.pars,3600);
    const b=r.baseline,f=r.final,t=e.targets;
    const residuals={baseline_pco2:b.pco2-t.pco2,baseline_po2:b.po2-t.po2,baseline_ph:b.pH-t.ph,
      drift_pco2_60:f.pco2-b.pco2,drift_po2_60:f.po2-b.po2,drift_ph_60:f.pH-b.pH,final_ph:f.pH-t.ph};
    const pass=Math.abs(residuals.baseline_pco2)<=8 && Math.abs(residuals.baseline_po2)<=20 &&
      Math.abs(residuals.drift_pco2_60)<=8 && Math.abs(residuals.drift_po2_60)<=20;
    rows.push({label:config.label,transformed,pars:config.pars,pass,residuals});
    console.log(JSON.stringify({label:config.label,transformed,pass}));
  }
}
const defaults=rows.filter(x=>x.label==='default_sid_original_nuisance');
for(const k of Object.keys(defaults[0].residuals)) assert(Math.abs(defaults[0].residuals[k]-defaults[1].residuals[k])<0.001,'default SID substitution not invariant');
assert(defaults.every(x=>x.pass),'original control not reproduced');
fs.writeFileSync(OUT,JSON.stringify({rows,substitutions,provenance:{post_index_data_loaded:false,
  hypothesis:'preserve source-prior venous PCO2 rather than source-prior bicarbonate when SID changes',
  venous_measurement_used:false,model_initialization_sensitivity_only:true,
  arterial_and_venous_oxygen_initialization_unchanged:true,
  nuisance_parameters_fixed_within_each_pair:true,production_files_changed:false}},null,2)+'\n',{flag:'wx'});
console.log('completed six paired 60-minute trajectories; default invariance passed');
