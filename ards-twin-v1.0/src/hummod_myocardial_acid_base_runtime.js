'use strict';

// Stateful reduced runtime for the HumMod left-heart lactate + CO2 mass states.
//
// Source equations:
// - Structure/LeftHeart/LeftHeart-Lactate.DES
// - Structure/LeftHeart/LeftHeart-CO2.DES
// - Structure/LeftHeart/LeftHeart-Ph.DES
//
// The differential equations are source-aligned. Numerical integration here is
// explicit Euler using the caller's timestep; this is not claimed to reproduce
// the original HumMod DES solver identity.

const {
  HEART_CONFIG:LACTATE_HEART_CONFIG,
  eulerStepMyocardialLactate,
}=require('./hummod_myocardial_lactate_source_aligned.js');
const {
  HEART_CONFIG:CO2_HEART_CONFIG,
  eulerStepMyocardialCo2,
}=require('./hummod_myocardial_co2_source_aligned.js');
const {
  myocardialAcidBaseState,
}=require('./hummod_myocardial_acid_base_state.js');

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}

function createHumModMyocardialAcidBaseRuntime({
  side='left',
  initialLactateMassMeq,
  initialCo2MassMeq,
}={}){
  if(side!=='left'&&side!=='right') throw new Error('side must be left or right');

  let lactateMass=initialLactateMassMeq==null
    ? LACTATE_HEART_CONFIG[side].initialMass
    : initialLactateMassMeq;
  let co2Mass=initialCo2MassMeq==null
    ? CO2_HEART_CONFIG[side].initialMass
    : initialCo2MassMeq;

  nonNegative(lactateMass,'initialLactateMassMeq');
  nonNegative(co2Mass,'initialCo2MassMeq');
  let timeSec=0;
  let last=null;

  function snapshot(){
    return Object.freeze({
      side,
      timeSec,
      lactateMassMeq:lactateMass,
      co2MassMeq:co2Mass,
      last,
      status:'HumMod-source-equation-myocardial-acid-base-runtime',
      numericalIntegration:'explicit-Euler',
      sourceSolverIdentity:false,
      controlAuthority:false,
    });
  }

  function step({
    dtSec,
    intracellularPotassium,
    liquidVolumeMl,
    bloodFlowMlPerMin,
    o2UseMlPerMin,
    bloodSid,
    arterialHco3,
    anaerobicGlucoseUsedMgPerMin,
    lactateUsedMgPerMin,
    lactatePoolConcentration,
    respiratoryQuotient,
  }={}){
    positive(dtSec,'dtSec');
    finite(intracellularPotassium,'intracellularPotassium');
    positive(liquidVolumeMl,'liquidVolumeMl');
    nonNegative(bloodFlowMlPerMin,'bloodFlowMlPerMin');
    nonNegative(o2UseMlPerMin,'o2UseMlPerMin');
    finite(bloodSid,'bloodSid');
    finite(arterialHco3,'arterialHco3');
    nonNegative(anaerobicGlucoseUsedMgPerMin,'anaerobicGlucoseUsedMgPerMin');
    nonNegative(lactateUsedMgPerMin,'lactateUsedMgPerMin');
    finite(lactatePoolConcentration,'lactatePoolConcentration');

    const dxMin=dtSec/60;

    const lactate=eulerStepMyocardialLactate({
      side,
      mass:lactateMass,
      liquidVolumeMl,
      anaerobicGlucoseUsedMgPerMin,
      lactateUsedMgPerMin,
      lactatePoolConcentration,
      dxMin,
    });

    const co2=eulerStepMyocardialCo2({
      side,
      mass:co2Mass,
      liquidVolumeMl,
      tissueSid:
        intracellularPotassium+0.012-0.117-(lactate.nextMass/liquidVolumeMl),
      bloodFlowMlPerMin,
      o2UseMlPerMin,
      bloodSid,
      arterialHco3,
      dxMin,
      ...(respiratoryQuotient==null?{}:{respiratoryQuotient}),
    });

    lactateMass=lactate.nextMass;
    co2Mass=co2.nextMass;
    timeSec+=dtSec;

    const acidBase=myocardialAcidBaseState({
      side,
      intracellularPotassium,
      myocardialLactate:lactateMass/liquidVolumeMl,
      co2Mass,
      liquidVolumeMl,
      bloodFlowMlPerMin,
      o2UseMlPerMin,
      bloodSid,
      arterialHco3,
      dxMin,
      ...(respiratoryQuotient==null?{}:{respiratoryQuotient}),
    });

    last=Object.freeze({
      timeSec,
      inputs:Object.freeze({
        dtSec,
        intracellularPotassium,
        liquidVolumeMl,
        bloodFlowMlPerMin,
        o2UseMlPerMin,
        bloodSid,
        arterialHco3,
        anaerobicGlucoseUsedMgPerMin,
        lactateUsedMgPerMin,
        lactatePoolConcentration,
      }),
      lactate,
      co2,
      acidBase,
      myocardialPco2MmHg:acidBase.myocardialPco2,
      intracellularPh:acidBase.intracellularPh,
      controlAuthority:false,
    });
    return last;
  }

  return Object.freeze({
    step,
    snapshot,
    status:'HumMod-source-equation-myocardial-acid-base-runtime',
    controlAuthority:false,
  });
}

module.exports=Object.freeze({
  createHumModMyocardialAcidBaseRuntime,
});
