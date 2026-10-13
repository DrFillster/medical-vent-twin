'use strict';

/**
 * HumMod 2013 source-generation-consistent myocardial acid-base runtime.
 *
 * Composition:
 *   plasma flow + substrate pools + insulin + myocardial O2 use/demand
 *     -> LeftHeart-Fuel / FractUseDelay
 *     -> LeftHeart-Lactate
 *   blood flow + O2 use + blood SID/HCO3 + KCell + LV liquid volume
 *     -> LeftHeart-CO2 + LeftHeart-Ph
 *
 * This runtime owns myocardial intracellular pH for the 2013 candidate.
 * It does NOT accept arterial pH as a myocardial-pH input.
 *
 * Remaining upstream states are explicit and fail closed.
 */

const {
  createHumMod2013LeftHeartFuel,
}=require('./hummod_2013_left_heart_fuel.js');
const {
  createHumMod2013LeftHeartLactate,
}=require('./hummod_2013_left_heart_lactate.js');
const {
  createHumMod2013LeftHeartCo2Ph,
}=require('./hummod_2013_left_heart_co2_ph.js');

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'93ee1b30b74a0f2e60a2c961bbf569b4c8237611',
  authority:'candidate-not-canonical',
  composition:Object.freeze([
    'Structure/LeftHeart/LeftHeart-Fuel.DES',
    'Structure/LeftHeart/LeftHeart-Lactate.DES',
    'Structure/LeftHeart/LeftHeart-CO2.DES',
    'Structure/LeftHeart/LeftHeart-Ph.DES',
    'Structure/CellSID/CellSID.DES',
    'Structure/AcidBase/PhCells.DES',
  ]),
});

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

function createHumMod2013MyocardialAcidBaseRuntime({
  initialLiquidVolumeMl,
  initialLactateMassMeq=0.17,
  initialFractUseDelay=1,
}={}){
  positive(initialLiquidVolumeMl,'initialLiquidVolumeMl');

  const fuel=createHumMod2013LeftHeartFuel({
    initialFractUseDelay,
  });
  const lactate=createHumMod2013LeftHeartLactate({
    initialMassMeq:initialLactateMassMeq,
  });
  const co2ph=createHumMod2013LeftHeartCo2Ph({
    initialLiquidVolumeMl,
  });

  let timeSec=0;
  let last=null;

  function step({
    dtSec,
    liquidVolumeMl,
    intracellularPotassium,

    bloodFlowMlPerMin,
    plasmaFlowMlPerMin,
    o2UseMlPerMin,
    aerobicCalsPerMin,
    totalCalsUsedPerMin,

    insulinReceptorBoundFractionPercent,
    glucosePoolMgPerMl,
    fattyAcidPoolMgPerMl,
    lactatePoolMeqPerMl,

    bloodSid,
    arterialHco3,
    respiratoryQuotient=0.8,
  }={}){
    positive(dtSec,'dtSec');
    positive(liquidVolumeMl,'liquidVolumeMl');
    finite(intracellularPotassium,'intracellularPotassium');
    nonNegative(bloodFlowMlPerMin,'bloodFlowMlPerMin');
    nonNegative(plasmaFlowMlPerMin,'plasmaFlowMlPerMin');
    nonNegative(o2UseMlPerMin,'o2UseMlPerMin');
    nonNegative(aerobicCalsPerMin,'aerobicCalsPerMin');
    positive(totalCalsUsedPerMin,'totalCalsUsedPerMin');
    nonNegative(insulinReceptorBoundFractionPercent,'insulinReceptorBoundFractionPercent');
    nonNegative(glucosePoolMgPerMl,'glucosePoolMgPerMl');
    nonNegative(fattyAcidPoolMgPerMl,'fattyAcidPoolMgPerMl');
    nonNegative(lactatePoolMeqPerMl,'lactatePoolMeqPerMl');
    finite(bloodSid,'bloodSid');
    finite(arterialHco3,'arterialHco3');
    finite(respiratoryQuotient,'respiratoryQuotient');

    const lactateBefore=lactate.snapshot({liquidVolumeMl});

    const fuelState=fuel.step({
      dtSec,
      insulinReceptorBoundFractionPercent,
      glucosePoolMgPerMl,
      fattyAcidPoolMgPerMl,
      lactatePoolMeqPerMl,
      plasmaFlowMlPerMin,
      myocardialLactateMeqPerMl:lactateBefore.lacMeqPerMl,
      aerobicCalsPerMin,
      totalCalsUsedPerMin,
      o2UseMlPerMin,
    });

    const lactateState=lactate.step({
      dtSec,
      liquidVolumeMl,
      bloodFlowMlPerMin,
      anaerobicGlucoseUsedMgPerMin:
        fuelState.anaerobicGlucoseUsedMgPerMin,
      lactateUsedMgPerMin:fuelState.lacUsedMgPerMin,
      lactatePoolMeqPerMl,
    });

    const co2PhState=co2ph.step({
      dtSec,
      liquidVolumeMl,
      intracellularPotassium,
      myocardialLactateMeqPerMl:lactateState.lacMeqPerMl,
      bloodFlowMlPerMin,
      o2UseMlPerMin,
      bloodSid,
      arterialHco3,
      respiratoryQuotient,
    });

    timeSec+=dtSec;
    last=Object.freeze({
      schema:'hummod-2013-myocardial-acid-base-runtime/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      timeSec,
      myocardialIntracellularPh:co2PhState.intracellularPh,
      myocardialPco2MmHg:co2PhState.pCO2MmHg,
      myocardialSid:co2PhState.sid.sid,
      myocardialSidMeqPerL:co2PhState.sid.sidMeqPerL,
      myocardialLactateMeqPerMl:lactateState.lacMeqPerMl,
      myocardialLactateMeqPerL:lactateState.lacMeqPerL,
      myocardialLactateMgPerDl:lactateState.lacMgPerDl,
      fuelFractUseDelay:fuelState.fractUseDelay,
      fuelAdequacy:fuelState.adequacy,
      fuel:fuelState,
      lactate:lactateState,
      co2Ph:co2PhState,
      inputs:Object.freeze({
        liquidVolumeMl,
        intracellularPotassium,
        bloodFlowMlPerMin,
        plasmaFlowMlPerMin,
        o2UseMlPerMin,
        aerobicCalsPerMin,
        totalCalsUsedPerMin,
        insulinReceptorBoundFractionPercent,
        glucosePoolMgPerMl,
        fattyAcidPoolMgPerMl,
        lactatePoolMeqPerMl,
        bloodSid,
        arterialHco3,
        respiratoryQuotient,
      }),
      numericalImplementation:Object.freeze({
        composition:
          'operator split: current lactate -> fuel -> backward-Euler lactate -> explicit-step CO2/pHi',
        sourceIdentity:
          'continuous/source algebra preserved; composed discrete execution requires convergence qualification',
      }),
      controlAuthority:false,
      provenance:SOURCE,
    });
    return last;
  }

  function snapshot(){
    return last||Object.freeze({
      schema:'hummod-2013-myocardial-acid-base-runtime/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      timeSec,
      myocardialIntracellularPh:null,
      fuelFractUseDelay:fuel.snapshot().fractUseDelay,
      controlAuthority:false,
      provenance:SOURCE,
    });
  }

  return Object.freeze({
    step,
    snapshot,
    source:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  createHumMod2013MyocardialAcidBaseRuntime,
});
