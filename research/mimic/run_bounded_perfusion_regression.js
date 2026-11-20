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
const OUT=BASE+'/bounded_perfusion_refiner_regression.json';

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






const {refine}=require('./bounded_perfusion_refiner');
const sweep=JSON.parse(fs.readFileSync(BASE+'/oxygen_capacity_fixed_sid_co2.json','utf8'));
const expected=JSON.parse(fs.readFileSync(BASE+'/oxygen_capacity_bracket_midpoints.json','utf8'));
const seedOf=x=>({vpf:x.pars.vpf,baselineCO2:x.baseline.pco2,baselineO2:x.baseline.po2,
 driftCO2:x.drift.pco2,driftO2:x.drift.po2,finalO2:x.final.po2,phResidual:x.final.pH});
const rows=[];
for(const id of [...new Set(sweep.rows.map(x=>x.event_id))]){
 const seeds=sweep.rows.filter(x=>x.event_id===id),base=seeds[0].pars,e=prefit.get(id);
 const result=refine({seeds:seeds.map(seedOf),maxEvaluations:4,evaluate(vpf){
  preserveSourceVenousPco2=true;
  const s=sessionFor(e,{...base,vpf});s.initialize();let elapsed=0;
  const points=[];
  for(const sec of [24,900,1800,2700,3600]){
   while(elapsed<sec){const h=Math.min(30,sec-elapsed);s.runFor(h);s.compactTraceHistory(60);elapsed+=h;}
   const g=s.snapshot().systemic.gasExchange;
   assert.strictEqual(g.ventilatedPerfusionFraction,vpf);
   assert([g.paco2MmHg,g.pao2MmHg,g.pH].every(Number.isFinite));
   points.push({sec,pco2:g.paco2MmHg,po2:g.pao2MmHg,pH:g.pH});
  }
  const b=points[0],f=points[4];
  return {vpf,baselineCO2:b.pco2-e.targets.pco2,baselineO2:b.po2-e.targets.po2,
   driftCO2:f.pco2-b.pco2,driftO2:f.po2-b.po2,finalO2:f.po2-e.targets.po2,
   phResidual:f.pH-e.targets.ph,points};
 }});
 const old=expected.rows.find(x=>x.event_id===id);
 assert.strictEqual(result.status,'pass');assert.strictEqual(result.evaluations,1);
 assert.strictEqual(result.selected.vpf,old.pars.vpf);
 const replayError=Math.max(Math.abs(result.selected.finalO2-old.residual.po2),Math.abs(result.selected.phResidual-old.residual.pH));
 assert(replayError<0.001);
 rows.push({event_id:id,result,replayError});
 console.log(JSON.stringify({completed:rows.length,status:result.status,newEvaluations:result.evaluations,retainedAttempts:result.attempts.length}));
}
fs.writeFileSync(OUT,JSON.stringify({rows,provenance:{post_index_data_loaded:false,
 seeds_from_existing_development_sweep:true,seed_simulations_not_rerun:true,
 fresh_hour_simulation_for_each_refinement:true,no_case_specific_brackets:true,
 fixed_sid_and_deadspace:true,ph_reported_not_gate:true,production_changed:false}},null,2)+'\n',{flag:'wx'});
console.log('completed generic refiner model regression');
