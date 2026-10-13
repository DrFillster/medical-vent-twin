'use strict';

/**
 * HumMod 2013 live left-heart liquid-volume runtime for v1.6.
 *
 * Source:
 * nysuloem/HumMod-UTSC-CPG@93ee1b30b74a0f2e60a2c961bbf569b4c8237611
 * - Structure/Sizing/Sizing-Composition-LeftHeart.DES
 * - Structure/LeftHeart/LeftHeart-Size.DES
 *
 * The source left-heart share of whole-body tissue water is established from
 * initialization and then applied to live interstitial + cell-water volumes.
 *
 * Candidate only. No canonical bedside authority.
 */

const {
  SOURCE:PROVIDER_SOURCE,
  initialLeftHeartComposition2013,
  leftHeartWaterScaling2013,
  currentLeftHeartLiquidVolume2013,
}=require('./hummod_2013_left_heart_liquid_volume_provider.js');

const SOURCE=Object.freeze({
  ...PROVIDER_SOURCE,
  implementation:'persistent source water-fraction scaling',
  authority:'candidate-not-canonical',
});

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

function createHumMod2013LeftHeartLiquidVolumeRuntime({
  initialLeftHeartMassG,
  initialTissueWaterVolumeMl,
  initialInterstitialWaterVolumeMl,
  initialCellWaterVolumeMl,
}={}){
  positive(initialLeftHeartMassG,'initialLeftHeartMassG');
  positive(initialTissueWaterVolumeMl,'initialTissueWaterVolumeMl');
  positive(initialInterstitialWaterVolumeMl,'initialInterstitialWaterVolumeMl');
  positive(initialCellWaterVolumeMl,'initialCellWaterVolumeMl');

  const composition=initialLeftHeartComposition2013({
    initialLeftHeartMassG,
  });
  const scaling=leftHeartWaterScaling2013({
    initialLeftHeartLiquidVolumeMl:composition.initialLiquidVolumeMl,
    initialTissueWaterVolumeMl,
    initialInterstitialWaterVolumeMl,
    initialCellWaterVolumeMl,
  });

  let timeSec=0;
  let last=null;

  function step({
    dtSec,
    interstitialWaterVolumeMl,
    cellWaterVolumeMl,
  }={}){
    positive(dtSec,'dtSec');
    positive(interstitialWaterVolumeMl,'interstitialWaterVolumeMl');
    positive(cellWaterVolumeMl,'cellWaterVolumeMl');

    const current=currentLeftHeartLiquidVolume2013({
      fractionTotal:scaling.fractionTotal,
      interstitialWaterVolumeMl,
      cellWaterVolumeMl,
    });

    timeSec+=dtSec;
    last=Object.freeze({
      schema:'hummod-2013-left-heart-liquid-volume-runtime/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      timeSec,
      initial:Object.freeze({
        composition,
        scaling,
        initialTissueWaterVolumeMl,
        initialInterstitialWaterVolumeMl,
        initialCellWaterVolumeMl,
      }),
      interstitialWaterVolumeMl,
      cellWaterVolumeMl,
      leftHeartInterstitialVolumeMl:current.leftHeartInterstitialVolumeMl,
      leftHeartCellWaterVolumeMl:current.leftHeartCellWaterVolumeMl,
      liquidVolumeMl:current.liquidVolumeMl,
      controlAuthority:false,
      provenance:SOURCE,
    });
    return last;
  }

  function snapshot(){
    return last||Object.freeze({
      schema:'hummod-2013-left-heart-liquid-volume-runtime/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      timeSec,
      liquidVolumeMl:null,
      initial:Object.freeze({composition,scaling}),
      controlAuthority:false,
      provenance:SOURCE,
    });
  }

  return Object.freeze({
    step,
    snapshot,
    source:SOURCE,
    fractionTotal:scaling.fractionTotal,
  });
}

module.exports=Object.freeze({
  SOURCE,
  createHumMod2013LeftHeartLiquidVolumeRuntime,
});
