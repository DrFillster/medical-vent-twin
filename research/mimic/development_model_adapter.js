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


function initializedPH(e,sid){const x=sessionFor(e,{sid}).initialize();return x.coupling.patientGasInitializationDiagnostics.initializedPH;}
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






module.exports={sessionFor,fitSid,setAlternative(value){preserveSourceVenousPco2=Boolean(value);}};
