'use strict';

/**
 * HumMod 2012/2013 persistent myocardial acid-base provider for v1.6.
 *
 * Purpose:
 * eliminate externally supplied myocardial intracellular pH.
 *
 * The provider owns the two myocardial state variables that must persist:
 * - LeftHeart lactate mass
 * - LeftHeart CO2/base mass
 *
 * It accepts exactly the nine upstream physiologic states identified for the
 * live cardiopulmonary integration boundary:
 *  1. blood SID
 *  2. arterial HCO3-
 *  3. intracellular K
 *  4. LV liquid volume
 *  5. myocardial blood flow
 *  6. myocardial O2 use
 *  7. anaerobic glucose use
 *  8. myocardial lactate use
 *  9. systemic lactate-pool concentration
 *
 * No arterial-pH -> myocardial-pHi substitution is permitted.
 * Candidate only. No canonical bedside authority.
 */

const {
  createHumMod2013LeftHeartLactate,
}=require('./hummod_2013_left_heart_lactate.js');
const {
  createHumMod2013LeftHeartCo2Ph,
}=require('./hummod_2013_left_heart_co2_ph.js');

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'93ee1b30b74a0f2e60a2c961bbf569b4c8237611',
  structures:Object.freeze([
    'Structure/LeftHeart/LeftHeart-Lactate.DES',
    'Structure/LeftHeart/LeftHeart-CO2.DES',
    'Structure/LeftHeart/LeftHeart-Ph.DES',
    'Structure/CellSID/CellSID.DES',
    'Structure/AcidBase/PhCells.DES',
  ]),
  authority:'candidate-not-canonical',
});

const REQUIRED_UPSTREAM=Object.freeze([
  'bloodSidMolPerL',
  'arterialHco3MolPerL',
  'intracellularPotassiumMeqPerMl',
  'leftVentricleLiquidVolumeMl',
  'myocardialBloodFlowMlPerMin',
  'myocardialO2UseMlPerMin',
  'anaerobicGlucoseUseMgPerMin',
  'myocardialLactateUseMgPerMin',
  'systemicLactatePoolMeqPerMl',
]);

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
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

function createHumMod2013LiveMyocardialAcidBaseProvider({
  initialLeftVentricleLiquidVolumeMl,
  initialMyocardialLactateMassMeq=0.17,
}={}){
  positive(
    initialLeftVentricleLiquidVolumeMl,
    'initialLeftVentricleLiquidVolumeMl'
  );
  nonNegative(
    initialMyocardialLactateMassMeq,
    'initialMyocardialLactateMassMeq'
  );

  const lactate=createHumMod2013LeftHeartLactate({
    initialMassMeq:initialMyocardialLactateMassMeq,
  });
  const co2ph=createHumMod2013LeftHeartCo2Ph({
    initialLiquidVolumeMl:initialLeftVentricleLiquidVolumeMl,
  });

  let timeSec=0;
  let last=null;

  function step({
    dtSec,
    bloodSidMolPerL,
    arterialHco3MolPerL,
    intracellularPotassiumMeqPerMl,
    leftVentricleLiquidVolumeMl,
    myocardialBloodFlowMlPerMin,
    myocardialO2UseMlPerMin,
    anaerobicGlucoseUseMgPerMin,
    myocardialLactateUseMgPerMin,
    systemicLactatePoolMeqPerMl,
    respiratoryQuotient=0.8,
  }={}){
    positive(dtSec,'dtSec');
    positive(leftVentricleLiquidVolumeMl,'leftVentricleLiquidVolumeMl');
    nonNegative(myocardialBloodFlowMlPerMin,'myocardialBloodFlowMlPerMin');
    nonNegative(myocardialO2UseMlPerMin,'myocardialO2UseMlPerMin');
    nonNegative(anaerobicGlucoseUseMgPerMin,'anaerobicGlucoseUseMgPerMin');
    finite(myocardialLactateUseMgPerMin,'myocardialLactateUseMgPerMin');
    nonNegative(systemicLactatePoolMeqPerMl,'systemicLactatePoolMeqPerMl');
    finite(intracellularPotassiumMeqPerMl,'intracellularPotassiumMeqPerMl');
    finite(bloodSidMolPerL,'bloodSidMolPerL');
    finite(arterialHco3MolPerL,'arterialHco3MolPerL');
    finite(respiratoryQuotient,'respiratoryQuotient');

    const lac=lactate.step({
      dtSec,
      liquidVolumeMl:leftVentricleLiquidVolumeMl,
      bloodFlowMlPerMin:myocardialBloodFlowMlPerMin,
      anaerobicGlucoseUsedMgPerMin:anaerobicGlucoseUseMgPerMin,
      lactateUsedMgPerMin:myocardialLactateUseMgPerMin,
      lactatePoolMeqPerMl:systemicLactatePoolMeqPerMl,
    });

    const acid=co2ph.step({
      dtSec,
      liquidVolumeMl:leftVentricleLiquidVolumeMl,
      intracellularPotassium:intracellularPotassiumMeqPerMl,
      myocardialLactateMeqPerMl:lac.lacMeqPerMl,
      bloodFlowMlPerMin:myocardialBloodFlowMlPerMin,
      o2UseMlPerMin:myocardialO2UseMlPerMin,
      bloodSid:bloodSidMolPerL,
      arterialHco3:arterialHco3MolPerL,
      respiratoryQuotient,
    });

    timeSec+=dtSec;
    last=Object.freeze({
      schema:'hummod-2013-live-myocardial-acid-base-provider/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      timeSec,
      myocardialIntracellularPh:acid.intracellularPh,
      myocardialPco2MmHg:acid.pCO2MmHg,
      myocardialSidMolPerL:acid.sid.sid,
      myocardialSidMeqPerL:acid.sid.sidMeqPerL,
      myocardialLactateMeqPerMl:lac.lacMeqPerMl,
      myocardialLactateMeqPerL:lac.lacMeqPerL,
      myocardialLactateMgPerDl:lac.lacMgPerDl,
      upstream:Object.freeze({
        bloodSidMolPerL,
        arterialHco3MolPerL,
        intracellularPotassiumMeqPerMl,
        leftVentricleLiquidVolumeMl,
        myocardialBloodFlowMlPerMin,
        myocardialO2UseMlPerMin,
        anaerobicGlucoseUseMgPerMin,
        myocardialLactateUseMgPerMin,
        systemicLactatePoolMeqPerMl,
      }),
      internalState:Object.freeze({
        myocardialLactateMassMeq:lac.massMeq,
        myocardialCo2Mass:acid.mass,
      }),
      lactate:lac,
      co2Ph:acid,
      controlAuthority:false,
      provenance:SOURCE,
    });
    return last;
  }

  function snapshot(){
    return last||Object.freeze({
      schema:'hummod-2013-live-myocardial-acid-base-provider/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      timeSec,
      myocardialIntracellularPh:null,
      controlAuthority:false,
      provenance:SOURCE,
    });
  }

  return Object.freeze({
    step,
    snapshot,
    source:SOURCE,
    requiredUpstream:REQUIRED_UPSTREAM,
  });
}

module.exports=Object.freeze({
  SOURCE,
  REQUIRED_UPSTREAM,
  createHumMod2013LiveMyocardialAcidBaseProvider,
});
