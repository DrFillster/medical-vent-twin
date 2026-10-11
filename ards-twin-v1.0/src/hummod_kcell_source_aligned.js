'use strict';

// Exact HumMod KCell concentration primitive.
// Pinned source:
// riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
// Structure/Electrolytes/K/KCell.DES

const TARGET_K_MEQ_PER_ML=0.142;
const CAPTIVE_MASS_MEQ=2180.0;
const ERROR_LIMIT_MEQ=39.8;

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

function initialKCellMassMeq({initialIcfvMl}={}){
  positive(initialIcfvMl,'initialIcfvMl');
  return TARGET_K_MEQ_PER_ML*initialIcfvMl;
}

function kCellConcentration({
  massMeq,
  cellWaterMl,
}={}){
  nonNegative(massMeq,'massMeq');
  positive(cellWaterMl,'cellWaterMl');
  const concentrationMeqPerMl=massMeq/cellWaterMl;
  return Object.freeze({
    massMeq,
    cellWaterMl,
    concentrationMeqPerMl,
    concentrationMeqPerL:1000*concentrationMeqPerMl,
    source:Object.freeze({
      targetConcentrationMeqPerMl:TARGET_K_MEQ_PER_ML,
      captiveMassMeq:CAPTIVE_MASS_MEQ,
      errorLimitMeq:ERROR_LIMIT_MEQ,
    }),
    controlAuthority:false,
  });
}

function kCellMassDerivative({
  gainMeqPerMin,
  lossMeqPerMin,
}={}){
  nonNegative(gainMeqPerMin,'gainMeqPerMin');
  nonNegative(lossMeqPerMin,'lossMeqPerMin');
  return gainMeqPerMin-lossMeqPerMin;
}

module.exports=Object.freeze({
  TARGET_K_MEQ_PER_ML,
  CAPTIVE_MASS_MEQ,
  ERROR_LIMIT_MEQ,
  initialKCellMassMeq,
  kCellConcentration,
  kCellMassDerivative,
});
