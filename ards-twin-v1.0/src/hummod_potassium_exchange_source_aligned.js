'use strict';

// Source-aligned HumMod extracellular/intracellular potassium exchange.
// Sources:
// Structure/Electrolytes/K/KCell.DES
// Structure/Electrolytes/K/KPool.DES
// Structure/Electrolytes/K/KFluxToCell.DES
// Structure/Electrolytes/K/KFluxToPool.DES
// pinned to riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1

const K_TO_CELL_BASIC_PER_MIN=0.002;
const K_TO_POOL_BASIC_PER_MIN=7.4e-5;
const KCELL_CAPTIVE_MASS_MEQ=2180.0;
const KPOOL_TARGET_MEQ_PER_ML=0.0044;

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
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

function potassiumFluxToCell({
  kPoolMassMeq,
  delayedAldosteroneEffect,
}={}){
  nonNegative(kPoolMassMeq,'kPoolMassMeq');
  nonNegative(delayedAldosteroneEffect,'delayedAldosteroneEffect');
  const rateConstantPerMin=K_TO_CELL_BASIC_PER_MIN*delayedAldosteroneEffect;
  return Object.freeze({
    rateConstantPerMin,
    rateMeqPerMin:rateConstantPerMin*kPoolMassMeq,
    controlAuthority:false,
  });
}

function potassiumFluxToPool({
  kCellMassMeq,
}={}){
  nonNegative(kCellMassMeq,'kCellMassMeq');
  const rateMeqPerMin=
    K_TO_POOL_BASIC_PER_MIN*(kCellMassMeq-KCELL_CAPTIVE_MASS_MEQ);
  return Object.freeze({
    rateConstantPerMin:K_TO_POOL_BASIC_PER_MIN,
    rateMeqPerMin,
    controlAuthority:false,
  });
}

function initialKPoolMassMeq({ecfvMl}={}){
  positive(ecfvMl,'ecfvMl');
  return KPOOL_TARGET_MEQ_PER_ML*ecfvMl;
}

function potassiumPoolConcentration({
  massMeq,
  initialEcfvMl,
}={}){
  nonNegative(massMeq,'massMeq');
  positive(initialEcfvMl,'initialEcfvMl');
  const concentrationMeqPerMl=massMeq/initialEcfvMl;
  return Object.freeze({
    concentrationMeqPerMl,
    concentrationMeqPerL:1000*concentrationMeqPerMl,
    controlAuthority:false,
  });
}

function potassiumPoolMassDerivative({
  giAbsorptionMeqPerMin,
  fluxToPoolMeqPerMin,
  ivDripMeqPerMin,
  transfusionMeqPerMin,
  collectingDuctOutflowMeqPerMin,
  fluxToCellMeqPerMin,
  sweatOutflowMeqPerMin,
  hemorrhageMeqPerMin,
  dialyzerFluxMeqPerMin,
}={}){
  const fields={
    giAbsorptionMeqPerMin,
    fluxToPoolMeqPerMin,
    ivDripMeqPerMin,
    transfusionMeqPerMin,
    collectingDuctOutflowMeqPerMin,
    fluxToCellMeqPerMin,
    sweatOutflowMeqPerMin,
    hemorrhageMeqPerMin,
    dialyzerFluxMeqPerMin,
  };
  for(const [k,v] of Object.entries(fields)) finite(v,k);

  const gain=
    giAbsorptionMeqPerMin+
    fluxToPoolMeqPerMin+
    ivDripMeqPerMin+
    transfusionMeqPerMin;
  const loss=
    collectingDuctOutflowMeqPerMin+
    fluxToCellMeqPerMin+
    sweatOutflowMeqPerMin+
    hemorrhageMeqPerMin+
    dialyzerFluxMeqPerMin;
  return Object.freeze({gainMeqPerMin:gain,lossMeqPerMin:loss,changeMeqPerMin:gain-loss});
}

function potassiumCellMassDerivative({
  fluxToCellMeqPerMin,
  fluxToPoolMeqPerMin,
}={}){
  finite(fluxToCellMeqPerMin,'fluxToCellMeqPerMin');
  finite(fluxToPoolMeqPerMin,'fluxToPoolMeqPerMin');
  return fluxToCellMeqPerMin-fluxToPoolMeqPerMin;
}

module.exports=Object.freeze({
  K_TO_CELL_BASIC_PER_MIN,
  K_TO_POOL_BASIC_PER_MIN,
  KCELL_CAPTIVE_MASS_MEQ,
  KPOOL_TARGET_MEQ_PER_ML,
  potassiumFluxToCell,
  potassiumFluxToPool,
  initialKPoolMassMeq,
  potassiumPoolConcentration,
  potassiumPoolMassDerivative,
  potassiumCellMassDerivative,
});
