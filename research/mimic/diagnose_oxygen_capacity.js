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
const OUT=BASE+'/oxygen_capacity_fixed_sid_co2.json';

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




const checkpoints=[0,24,300,900,1800,2700,3600];
const input=JSON.parse(fs.readFileSync(BASE+'/acid_base_joint_smoke_4.json','utf8')).filter(x=>!x.previous_pass).slice(1);
assert.strictEqual(input.length,2);
const previous=JSON.parse(fs.readFileSync(BASE+'/venous_sid_failure_timecourses.json','utf8'));
const rows=[];
for(const item of input){
 const e=prefit.get(item.event_id),f=item.fitted;
 for(const vpf of VPF){
  preserveSourceVenousPco2=true;
  const pars={sid:f.latent_sid_mol_per_l,co2:f.effective_co2_elimination_fraction,vpf};
  const s=sessionFor(e,pars);s.initialize();let elapsed=0;
  const points=checkpoints.map(sec=>{
   while(elapsed<sec){const h=Math.min(30,sec-elapsed);s.runFor(h);s.compactTraceHistory(60);elapsed+=h;}
   const g=s.snapshot().systemic.gasExchange;
   const x={sec,pco2:g.paco2MmHg,po2:g.pao2MmHg,pH:g.pH};
   assert(Object.values(x).every(Number.isFinite));return x;
  });
  const at=sec=>points.find(x=>x.sec===sec);
  const residual=sec=>({pco2:at(sec).pco2-e.targets.pco2,po2:at(sec).po2-e.targets.po2,pH:at(sec).pH-e.targets.ph});
  const delta=(a,b)=>Object.fromEntries(['pco2','po2','pH'].map(k=>[k,at(b)[k]-at(a)[k]]));
  const baseline=residual(24),final=residual(3600),drift=delta(24,3600);
  const pass=Math.abs(baseline.pco2)<=8&&Math.abs(baseline.po2)<=20&&Math.abs(drift.pco2)<=8&&Math.abs(drift.po2)<=20;
  let replayError=null;
  if(vpf===f.effective_ventilated_perfusion_fraction){
   const prior=previous.rows.find(x=>x.event_id===e.event_id&&x.transformed);
   replayError=Math.max(...['pco2','po2','pH'].map(k=>Math.abs(prior.final[k]-final[k])));
   assert(replayError<0.001,'selected candidate replay mismatch');
  }
  rows.push({event_id:e.event_id,pars,points,baseline,final,drift,late:delta(1800,3600),pass,replayError});
  console.log(JSON.stringify({completed:rows.length,vpf,pass}));
 }
}
fs.writeFileSync(OUT,JSON.stringify({rows,provenance:{post_index_data_loaded:false,
 fixed_prior_sid_and_co2:true,existing_vpf_grid_only:true,source_venous_pco2_preserved:true,
 historical_gate_unchanged:true,all_candidates_full_60_min:true,production_changed:false}},null,2)+'\n',{flag:'wx'});
console.log('completed 16 full-horizon oxygenation candidates');
