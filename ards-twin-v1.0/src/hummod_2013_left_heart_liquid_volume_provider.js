'use strict';

/**
 * HumMod 2013 left-heart composition / liquid-volume provider.
 *
 * Source:
 * nysuloem/HumMod-UTSC-CPG@93ee1b30b74a0f2e60a2c961bbf569b4c8237611
 * - Structure/Sizing/Sizing-Composition-LeftHeart.DES
 * - Structure/LeftHeart/LeftHeart-Size.DES
 *
 * Initial composition is fully source-defined once initial LV mass is known.
 * Current liquid volume still requires whole-body water compartments.
 */

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'93ee1b30b74a0f2e60a2c961bbf569b4c8237611',
  authority:'candidate-not-canonical',
});

const H2O_FRACT_MASS=0.67;
const H2O_DENSITY_G_PER_ML=1.0;

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}

function initialLeftHeartComposition2013({
  initialLeftHeartMassG,
}={}){
  positive(initialLeftHeartMassG,'initialLeftHeartMassG');
  const initialLiquidVolumeMl=
    H2O_FRACT_MASS*initialLeftHeartMassG/H2O_DENSITY_G_PER_ML;
  const initialSolidMassG=
    (1-H2O_FRACT_MASS)*initialLeftHeartMassG;
  return Object.freeze({
    initialLeftHeartMassG,
    initialLiquidVolumeMl,
    initialSolidMassG,
    h2oFractMass:H2O_FRACT_MASS,
    controlAuthority:false,
    provenance:SOURCE,
  });
}

function leftHeartWaterScaling2013({
  initialLeftHeartLiquidVolumeMl,
  initialTissueWaterVolumeMl,
  initialInterstitialWaterVolumeMl,
  initialCellWaterVolumeMl,
}={}){
  [
    ['initialLeftHeartLiquidVolumeMl',initialLeftHeartLiquidVolumeMl],
    ['initialTissueWaterVolumeMl',initialTissueWaterVolumeMl],
    ['initialInterstitialWaterVolumeMl',initialInterstitialWaterVolumeMl],
    ['initialCellWaterVolumeMl',initialCellWaterVolumeMl],
  ].forEach(([k,v])=>positive(v,k));

  const fractionTotal=
    initialLeftHeartLiquidVolumeMl/initialTissueWaterVolumeMl;
  return Object.freeze({
    fractionTotal,
    initialLeftHeartInterstitialVolumeMl:
      fractionTotal*initialInterstitialWaterVolumeMl,
    initialLeftHeartCellWaterVolumeMl:
      fractionTotal*initialCellWaterVolumeMl,
    controlAuthority:false,
    provenance:SOURCE,
  });
}

function currentLeftHeartLiquidVolume2013({
  fractionTotal,
  interstitialWaterVolumeMl,
  cellWaterVolumeMl,
}={}){
  positive(fractionTotal,'fractionTotal');
  positive(interstitialWaterVolumeMl,'interstitialWaterVolumeMl');
  positive(cellWaterVolumeMl,'cellWaterVolumeMl');

  const leftHeartInterstitialVolumeMl=
    fractionTotal*interstitialWaterVolumeMl;
  const leftHeartCellWaterVolumeMl=
    fractionTotal*cellWaterVolumeMl;
  const liquidVolumeMl=
    leftHeartInterstitialVolumeMl+leftHeartCellWaterVolumeMl;

  return Object.freeze({
    fractionTotal,
    leftHeartInterstitialVolumeMl,
    leftHeartCellWaterVolumeMl,
    liquidVolumeMl,
    controlAuthority:false,
    provenance:SOURCE,
  });
}

const READINESS=Object.freeze({
  initialComposition:'parallel-source-complete-once-initial-LV-mass-is-supplied',
  currentLiquidVolume:'blocked-on-whole-body-water-compartments',
  missingLiveProviders:Object.freeze([
    'TissueH2O.InitialVol',
    'InterstitialWater.InitialVol',
    'CellH2O.InitialVol',
    'InterstitialWater.Vol',
    'CellH2O.Vol',
  ]),
  fixedInitialLiquidVolumeSubstitutionAllowed:false,
});

module.exports=Object.freeze({
  SOURCE,
  H2O_FRACT_MASS,
  H2O_DENSITY_G_PER_ML,
  READINESS,
  initialLeftHeartComposition2013,
  leftHeartWaterScaling2013,
  currentLeftHeartLiquidVolume2013,
});
