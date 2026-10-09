'use strict';

const {humModSource}=require('./hummod_source_identity.js');

const NORMAL_HCT=0.44;
const BASIC_HGB_G_PER_ML=0.15;
const O2_MAX_ML_PER_G_HGB=1.34;

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function fraction(v,label){
  finite(v,label);
  if(v<0||v>1) throw new Error(label+' must be between 0 and 1');
  return v;
}

function hgbConcentrationFromHematocrit({
  hematocritFraction,
  carboxyPercent=0,
  clamp=false,
  clampTotalHgbGPerMl=0,
}={}){
  fraction(hematocritFraction,'hematocritFraction');
  finite(carboxyPercent,'carboxyPercent');
  if(carboxyPercent<0||carboxyPercent>100){
    throw new Error('carboxyPercent must be between 0 and 100');
  }
  finite(clampTotalHgbGPerMl,'clampTotalHgbGPerMl');
  if(clampTotalHgbGPerMl<0) throw new Error('clampTotalHgbGPerMl must be >= 0');

  const hctEffect=hematocritFraction/NORMAL_HCT;
  const totalHgbGPerMl=clamp
    ? clampTotalHgbGPerMl
    : hctEffect*BASIC_HGB_G_PER_ML;
  const carboxyHgbGPerMl=totalHgbGPerMl*(carboxyPercent/100);
  const freeHgbGPerMl=Math.max(totalHgbGPerMl-carboxyHgbGPerMl,0);
  const gasMaxContentMlPerMl=O2_MAX_ML_PER_G_HGB*totalHgbGPerMl;
  const o2MaxMlPerMl=O2_MAX_ML_PER_G_HGB*freeHgbGPerMl;

  return Object.freeze({
    hematocritFraction,
    hctEffect,
    totalHgbGPerMl,
    carboxyHgbGPerMl,
    freeHgbGPerMl,
    carboxyPercent,
    gasMaxContentMlPerMl,
    o2MaxMlPerMl,
    provenance:Object.freeze({
      status:'source-aligned-HgbConc',
      source:humModSource('Structure/Hemoglobin/HgbConc.DES','HgbConc.Calc'),
      carboxyBoundary:
        'carboxyPercent supplied directly until CO concentration/mass pool is ported',
      clinicalValidation:false,
    }),
  });
}

module.exports={
  NORMAL_HCT,
  BASIC_HGB_G_PER_ML,
  O2_MAX_ML_PER_G_HGB,
  hgbConcentrationFromHematocrit,
};
