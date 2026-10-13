'use strict';

/**
 * v1.6 myocardial upstream-state composition runtime.
 *
 * Purpose:
 * derive the nine inputs required by the persistent myocardial acid-base
 * provider from source-owned upstream runtimes wherever those runtimes are
 * already available.
 *
 * Resolved here:
 * - blood SID + arterial HCO3- from live gas snapshot
 * - myocardial blood flow + O2 use from integrated cardiopulmonary snapshot
 * - anaerobic glucose use from exact HumMod-2013 source state
 * - intracellular K from persistent KCell runtime
 * - LV liquid volume from persistent left-heart water scaling
 * - systemic lactate concentration from persistent LacPool runtime
 *
 * Still explicit/fail-closed:
 * - myocardial lactate use, because its HumMod LeftHeart-Fuel equation requires
 *   additional live substrate/metabolic states not yet present in the
 *   cardiopulmonary candidate.
 */

const {
  resolveLiveChemistryFromGasSnapshot,
  resolveIntegratedMyocardialSourceState,
}=require('./v16_myocardial_live_input_adapter.js');
const {
  sourceAnaerobicGlucoseUse2013,
}=require('./hummod_2013_left_heart_fuel.js');
const {
  createHumMod2013KCellRuntime,
}=require('./hummod_2013_kcell_runtime.js');
const {
  createHumMod2013LeftHeartLiquidVolumeRuntime,
}=require('./hummod_2013_left_heart_liquid_volume_runtime.js');
const {
  createHumMod2013SystemicLactatePoolRuntime,
}=require('./hummod_2013_systemic_lactate_pool_runtime.js');

const SOURCE=Object.freeze({
  authority:'candidate-not-canonical',
  role:'source-owned myocardial upstream-state composition',
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}

function createV16MyocardialUpstreamRuntime({
  initialIcfvMl,
  initialLeftHeartMassG,
  initialTissueWaterVolumeMl,
  initialInterstitialWaterVolumeMl,
  initialCellWaterVolumeMl,
  initialEcfvMl,
}={}){
  positive(initialIcfvMl,'initialIcfvMl');
  positive(initialLeftHeartMassG,'initialLeftHeartMassG');
  positive(initialTissueWaterVolumeMl,'initialTissueWaterVolumeMl');
  positive(initialInterstitialWaterVolumeMl,'initialInterstitialWaterVolumeMl');
  positive(initialCellWaterVolumeMl,'initialCellWaterVolumeMl');
  positive(initialEcfvMl,'initialEcfvMl');

  const kCell=createHumMod2013KCellRuntime({initialIcfvMl});
  const lvWater=createHumMod2013LeftHeartLiquidVolumeRuntime({
    initialLeftHeartMassG,
    initialTissueWaterVolumeMl,
    initialInterstitialWaterVolumeMl,
    initialCellWaterVolumeMl,
  });
  const lactatePool=createHumMod2013SystemicLactatePoolRuntime({
    initialEcfvMl,
  });

  let timeSec=0;
  let last=null;

  function step({
    dtSec,
    gasSnapshot,
    cardiopulmonarySnapshot,
    kPoolMassMeq,
    delayedAldosteroneEffect,
    interstitialWaterVolumeMl,
    cellWaterVolumeMl,
    ecfvMl,
    tissueLactateOutflowsMeqPerMin,
    ivDripLactateRateMeqPerMin,
    lactatePumpRateMeqPerMin,
    myocardialLactateUseMgPerMin,
  }={}){
    positive(dtSec,'dtSec');
    nonNegative(myocardialLactateUseMgPerMin,'myocardialLactateUseMgPerMin');

    const chemistry=resolveLiveChemistryFromGasSnapshot(gasSnapshot);
    const myocardial=
      resolveIntegratedMyocardialSourceState(cardiopulmonarySnapshot);
    const anaerobic=sourceAnaerobicGlucoseUse2013();

    const k=kCell.step({
      dtSec,
      kPoolMassMeq,
      delayedAldosteroneEffect,
      cellWaterVolumeMl,
    });

    const water=lvWater.step({
      dtSec,
      interstitialWaterVolumeMl,
      cellWaterVolumeMl,
    });

    const lac=lactatePool.step({
      dtSec,
      ecfvMl,
      tissueOutflowsMeqPerMin:tissueLactateOutflowsMeqPerMin,
      ivDripLactateRateMeqPerMin,
      pumpRateMeqPerMin:lactatePumpRateMeqPerMin,
    });

    timeSec+=dtSec;
    const nine=Object.freeze({
      bloodSidMolPerL:chemistry.bloodSidMolPerL,
      arterialHco3MolPerL:chemistry.arterialHco3MolPerL,
      intracellularPotassiumMeqPerMl:k.concentrationMeqPerMl,
      leftVentricleLiquidVolumeMl:water.liquidVolumeMl,
      myocardialBloodFlowMlPerMin:myocardial.myocardialBloodFlowMlPerMin,
      myocardialO2UseMlPerMin:myocardial.myocardialO2UseMlPerMin,
      anaerobicGlucoseUseMgPerMin:
        anaerobic.anaerobicGlucoseUsedMgPerMin,
      myocardialLactateUseMgPerMin,
      systemicLactatePoolMeqPerMl:lac.concentrationMeqPerMl,
    });

    last=Object.freeze({
      schema:'v16-myocardial-upstream-runtime/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      timeSec,
      myocardialAcidBaseInputs:nine,
      sourceStates:Object.freeze({
        intracellularPotassium:k,
        leftVentricleWater:water,
        systemicLactatePool:lac,
      }),
      unresolvedSourceDependency:Object.freeze({
        myocardialLactateUse:
          'requires live HumMod LeftHeart-Fuel substrate/metabolic inputs',
      }),
      controlAuthority:false,
      provenance:SOURCE,
    });
    return last;
  }

  function snapshot(){
    return last||Object.freeze({
      schema:'v16-myocardial-upstream-runtime/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      timeSec,
      myocardialAcidBaseInputs:null,
      unresolvedSourceDependency:Object.freeze({
        myocardialLactateUse:
          'requires live HumMod LeftHeart-Fuel substrate/metabolic inputs',
      }),
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
  createV16MyocardialUpstreamRuntime,
});
