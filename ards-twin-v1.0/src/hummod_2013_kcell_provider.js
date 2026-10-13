'use strict';

/**
 * HumMod 2013 intracellular potassium provider contract.
 *
 * Sources:
 * nysuloem/HumMod-UTSC-CPG@93ee1b30b74a0f2e60a2c961bbf569b4c8237611
 * - Structure/K/KCell.DES
 * - Structure/K/KFluxToCell.DES
 * - Structure/K/KFluxToPool.DES
 * - Structure/Sizing/Sizing-PotassiumCell.DES
 * - Structure/Sizing/Sizing-ICFV.DES
 *
 * Initial intracellular [K+] is source-defined at 140 mEq/L.
 * Current [K+] requires dynamic KCell mass and CellH2O volume.
 */

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'93ee1b30b74a0f2e60a2c961bbf569b4c8237611',
  authority:'candidate-not-canonical',
});

const INITIAL_KCELL_MEQ_PER_L=140.0;
const KCELL_CAPTIVE_MASS_MEQ=2180.0;
const K_TO_CELL_BASIC_PER_MIN=0.0018;
const K_TO_POOL_BASIC_PER_MIN=8.0e-5;

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

function initialKCellMass2013({initialIcfvMl}={}){
  positive(initialIcfvMl,'initialIcfvMl');
  const initialIcfvL=initialIcfvMl/1000;
  return Object.freeze({
    initialIcfvMl,
    initialIcfvL,
    initialConcentrationMeqPerL:INITIAL_KCELL_MEQ_PER_L,
    initialMassMeq:INITIAL_KCELL_MEQ_PER_L*initialIcfvL,
    controlAuthority:false,
    provenance:SOURCE,
  });
}

function kCellConcentration2013({
  kCellMassMeq,
  cellWaterVolumeMl,
}={}){
  nonNegative(kCellMassMeq,'kCellMassMeq');
  positive(cellWaterVolumeMl,'cellWaterVolumeMl');
  const concentrationMeqPerMl=kCellMassMeq/cellWaterVolumeMl;
  return Object.freeze({
    kCellMassMeq,
    cellWaterVolumeMl,
    concentrationMeqPerMl,
    concentrationMeqPerL:1000*concentrationMeqPerMl,
    controlAuthority:false,
    provenance:SOURCE,
  });
}

function kFluxToCell2013({
  kPoolMassMeq,
  delayedAldosteroneEffect,
}={}){
  nonNegative(kPoolMassMeq,'kPoolMassMeq');
  nonNegative(delayedAldosteroneEffect,'delayedAldosteroneEffect');
  const rateConstantPerMin=
    K_TO_CELL_BASIC_PER_MIN*delayedAldosteroneEffect;
  return Object.freeze({
    rateConstantPerMin,
    rateMeqPerMin:rateConstantPerMin*kPoolMassMeq,
    controlAuthority:false,
    provenance:SOURCE,
  });
}

function kFluxToPool2013({
  kCellMassMeq,
}={}){
  nonNegative(kCellMassMeq,'kCellMassMeq');
  return Object.freeze({
    rateConstantPerMin:K_TO_POOL_BASIC_PER_MIN,
    rateMeqPerMin:
      K_TO_POOL_BASIC_PER_MIN*(kCellMassMeq-KCELL_CAPTIVE_MASS_MEQ),
    controlAuthority:false,
    provenance:SOURCE,
  });
}

const READINESS=Object.freeze({
  initialKCell:'parallel-source-complete-if-initial-ICFV-is-supplied',
  currentKCellConcentration:'blocked-on-whole-body-potassium-and-cell-water-state',
  requiredLiveProviders:Object.freeze([
    'KCell.Mass',
    'CellH2O.Vol',
    'KPool.Mass',
    'KAldoEffect.Delayed',
    'whole-body K gains/losses for KPool balance',
  ]),
  fixed140MeqPerLSubstitutionAllowed:false,
  olderPotassiumModuleInterchangeable:false,
  generationMismatch:Object.freeze({
    olderKToCellBasicPerMin:0.002,
    hummod2013KToCellBasicPerMin:K_TO_CELL_BASIC_PER_MIN,
    olderKToPoolBasicPerMin:7.4e-5,
    hummod2013KToPoolBasicPerMin:K_TO_POOL_BASIC_PER_MIN,
  }),
});

module.exports=Object.freeze({
  SOURCE,
  INITIAL_KCELL_MEQ_PER_L,
  KCELL_CAPTIVE_MASS_MEQ,
  K_TO_CELL_BASIC_PER_MIN,
  K_TO_POOL_BASIC_PER_MIN,
  READINESS,
  initialKCellMass2013,
  kCellConcentration2013,
  kFluxToCell2013,
  kFluxToPool2013,
});
