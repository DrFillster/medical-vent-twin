'use strict';

// Exact algebraic LeftHeart-Size relationships from HumMod.
// Pinned source:
// riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
// Structure/LeftHeart/LeftHeart-Size.DES

const MASS_FRACT_BASE=0.0105;
const H2O_FRACT_MASS=0.67;
const LIQUID_DENSITY=1.0;
const OTHER_FRACT_SOLIDS=0.30;
const CONTRACTILE_PROTEIN_DENSITY=1.17;
const OTHER_DENSITY=1.17;

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

function initializeLeftHeartSize({initialOtherBodyMassG}={}){
  positive(initialOtherBodyMassG,'initialOtherBodyMassG');

  const initialMassG=MASS_FRACT_BASE*initialOtherBodyMassG;
  const initialLiquidVolumeMl=
    H2O_FRACT_MASS*initialMassG/LIQUID_DENSITY;
  const solidsFractionMass=1-H2O_FRACT_MASS;
  const initialSolidMassG=solidsFractionMass*initialMassG;
  const initialOtherMassG=OTHER_FRACT_SOLIDS*initialSolidMassG;
  const proteinFractionSolids=1-OTHER_FRACT_SOLIDS;
  const initialContractileProteinMassG=
    proteinFractionSolids*initialSolidMassG;

  return Object.freeze({
    initialMassG,
    initialLiquidVolumeMl,
    solidsFractionMass,
    initialSolidMassG,
    initialOtherMassG,
    proteinFractionSolids,
    initialContractileProteinMassG,
    controlAuthority:false,
  });
}

function leftHeartWaterFractions({
  initialLiquidVolumeMl,
  initialTissueWaterVolumeMl,
  initialInterstitialWaterVolumeMl,
  initialCellWaterVolumeMl,
}={}){
  [
    ['initialLiquidVolumeMl',initialLiquidVolumeMl],
    ['initialTissueWaterVolumeMl',initialTissueWaterVolumeMl],
    ['initialInterstitialWaterVolumeMl',initialInterstitialWaterVolumeMl],
    ['initialCellWaterVolumeMl',initialCellWaterVolumeMl],
  ].forEach(([k,v])=>positive(v,k));

  const fractionTotal=initialLiquidVolumeMl/initialTissueWaterVolumeMl;
  return Object.freeze({
    fractionTotal,
    initialInterstitialVolumeMl:
      fractionTotal*initialInterstitialWaterVolumeMl,
    initialCellWaterVolumeMl:
      fractionTotal*initialCellWaterVolumeMl,
    controlAuthority:false,
  });
}

function leftHeartSize({
  fractionTotal,
  interstitialWaterVolumeMl,
  cellWaterVolumeMl,
  contractileProteinMassG,
  initialOtherMassG,
}={}){
  finite(fractionTotal,'fractionTotal');
  if(!(fractionTotal>0)) throw new Error('fractionTotal must be > 0');
  [
    ['interstitialWaterVolumeMl',interstitialWaterVolumeMl],
    ['cellWaterVolumeMl',cellWaterVolumeMl],
    ['contractileProteinMassG',contractileProteinMassG],
    ['initialOtherMassG',initialOtherMassG],
  ].forEach(([k,v])=>nonNegative(v,k));

  const interstitialVolumeMl=fractionTotal*interstitialWaterVolumeMl;
  const cellularWaterVolumeMl=fractionTotal*cellWaterVolumeMl;
  const liquidVolumeMl=interstitialVolumeMl+cellularWaterVolumeMl;
  const liquidMassG=liquidVolumeMl*LIQUID_DENSITY;
  const otherMassG=initialOtherMassG;
  const solidMassG=contractileProteinMassG+otherMassG;
  const contractileProteinVolumeMl=
    contractileProteinMassG/CONTRACTILE_PROTEIN_DENSITY;
  const otherVolumeMl=otherMassG/OTHER_DENSITY;
  const solidVolumeMl=contractileProteinVolumeMl+otherVolumeMl;
  const massG=liquidMassG+solidMassG;
  const volumeMl=liquidVolumeMl+solidVolumeMl;
  const densityGPerMl=massG/volumeMl;

  return Object.freeze({
    interstitialVolumeMl,
    cellularWaterVolumeMl,
    liquidVolumeMl,
    liquidMassG,
    contractileProteinMassG,
    otherMassG,
    solidMassG,
    contractileProteinVolumeMl,
    otherVolumeMl,
    solidVolumeMl,
    massG,
    volumeMl,
    densityGPerMl,
    controlAuthority:false,
  });
}

module.exports=Object.freeze({
  MASS_FRACT_BASE,
  H2O_FRACT_MASS,
  LIQUID_DENSITY,
  OTHER_FRACT_SOLIDS,
  CONTRACTILE_PROTEIN_DENSITY,
  OTHER_DENSITY,
  initializeLeftHeartSize,
  leftHeartWaterFractions,
  leftHeartSize,
});
