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
const OUT=BASE+'/oxygen_midpoint_robustness.json';

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






const inputs=JSON.parse(fs.readFileSync(BASE+'/oxygen_capacity_bracket_midpoints.json','utf8'));
assert.strictEqual(inputs.rows.length,2);
const rows=[];
function gate(b,f,t){
 const failures=[];
 if(Math.abs(b.paco2MmHg-t.pco2)>8)failures.push('baseline_CO2');
 if(Math.abs(b.pao2MmHg-t.po2)>20)failures.push('baseline_O2');
 if(Math.abs(f.paco2MmHg-b.paco2MmHg)>8)failures.push('drift_CO2');
 if(Math.abs(f.pao2MmHg-b.pao2MmHg)>20)failures.push('drift_O2');
 return {pass:failures.length===0,failures};
}
for(const input of inputs.rows){
 for(const offset of [0,-0.005,0.005]){
  preserveSourceVenousPco2=true;
  const pars={...input.pars,vpf:input.pars.vpf+offset};
  assert(pars.vpf>=input.bracket[0]&&pars.vpf<=input.bracket[1]);
  const e=prefit.get(input.event_id),s=sessionFor(e,pars);s.initialize();let elapsed=0;
  const points=[];
  for(const sec of [24,900,1800,2700,3600,5400,7200]){
   while(elapsed<sec){const h=Math.min(30,sec-elapsed);s.runFor(h);s.compactTraceHistory(60);elapsed+=h;}
   const x=s.snapshot(),g=x.systemic.gasExchange;
   assert([g.paco2MmHg,g.pao2MmHg,g.pH].every(Number.isFinite));
   assert.strictEqual(g.ventilatedPerfusionFraction,pars.vpf);
   points.push({sec,gas:g});
  }
  const b=points[0].gas,f=points.find(x=>x.sec===3600).gas,z=points[6].gas;
  let replayError=null;
  if(offset===0){
   const old=input.points.find(x=>x.sec===3600).gas;
   replayError=Math.max(...['paco2MmHg','pao2MmHg','pH'].map(k=>Math.abs(old[k]-f[k])));
   assert(replayError<0.001,'midpoint replay failed');
  }
  const residual=g=>({pco2:g.paco2MmHg-e.targets.pco2,po2:g.pao2MmHg-e.targets.po2,pH:g.pH-e.targets.ph});
  const late=Object.fromEntries(['paco2MmHg','pao2MmHg','pH'].map(k=>[k,z[k]-f[k]]));
  const row={event_id:e.event_id,offset,pars,points,replayError,hourGate:gate(b,f,e.targets),
   extendedGate:gate(b,z,e.targets),hourResidual:residual(f),extendedResidual:residual(z),late};
  rows.push(row);console.log(JSON.stringify({completed:rows.length,offset,hour:row.hourGate,extended:row.extendedGate}));
 }
}
fs.writeFileSync(OUT,JSON.stringify({rows,provenance:{post_index_data_loaded:false,
 parameters_retuned:false,offsets_declared_before_results:[0,-0.005,0.005],
 all_runs_120_minutes:true,ph_reported_not_gate:true,historical_hour_gate_unchanged:true,
 extended_gate_is_descriptive_not_locked_validation:true,production_changed:false}},null,2)+'\n',{flag:'wx'});
console.log('completed six 120-minute midpoint sensitivity trajectories');
