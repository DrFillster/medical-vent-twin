'use strict';

// Source-aligned HumMod LacPool primitive.
// Source: Structure/Lactate/LacPool.DES
// pinned to riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1

const INITIAL_LACTATE_POOL_MASS_MEQ=15.0;
const ERROR_LIMIT_MEQ=0.150;
const MEQ_ML_TO_MG_DL=9008.0;

const OUTFLOW_KEYS=Object.freeze([
  'bone',
  'brain',
  'fat',
  'giTract',
  'kidney',
  'leftHeart',
  'liver',
  'otherTissue',
  'respiratoryMuscle',
  'rightHeart',
  'skeletalMuscle',
  'skin',
]);

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

function lactatePoolConcentration({
  massMeq,
  ecfvMl,
}={}){
  nonNegative(massMeq,'massMeq');
  positive(ecfvMl,'ecfvMl');
  const concentrationMeqPerMl=massMeq/ecfvMl;
  return Object.freeze({
    concentrationMeqPerMl,
    concentrationMeqPerL:1000*concentrationMeqPerMl,
    concentrationMgDl:MEQ_ML_TO_MG_DL*concentrationMeqPerMl,
    controlAuthority:false,
  });
}

function lactatePoolPumpRate({
  pumpSwitch=false,
  pumpSettingMeqPerMin=0,
}={}){
  finite(pumpSettingMeqPerMin,'pumpSettingMeqPerMin');
  return pumpSwitch?pumpSettingMeqPerMin:0;
}

function lactatePoolMassDerivative({
  tissueOutflowsMeqPerMin,
  pumpRateMeqPerMin=0,
}={}){
  if(!tissueOutflowsMeqPerMin||
     typeof tissueOutflowsMeqPerMin!=='object'||
     Array.isArray(tissueOutflowsMeqPerMin)){
    throw new Error('tissueOutflowsMeqPerMin object is required');
  }
  finite(pumpRateMeqPerMin,'pumpRateMeqPerMin');

  const missing=OUTFLOW_KEYS.filter(k=>tissueOutflowsMeqPerMin[k]==null);
  if(missing.length){
    throw new Error('lactate pool requires all tissue outflows; missing: '+missing.join(', '));
  }

  let tissueTotal=0;
  for(const k of OUTFLOW_KEYS){
    finite(tissueOutflowsMeqPerMin[k],k+'OutflowMeqPerMin');
    tissueTotal+=tissueOutflowsMeqPerMin[k];
  }
  return Object.freeze({
    tissueOutflowTotalMeqPerMin:tissueTotal,
    pumpRateMeqPerMin,
    changeMeqPerMin:tissueTotal+pumpRateMeqPerMin,
    controlAuthority:false,
  });
}

module.exports=Object.freeze({
  INITIAL_LACTATE_POOL_MASS_MEQ,
  ERROR_LIMIT_MEQ,
  MEQ_ML_TO_MG_DL,
  OUTFLOW_KEYS,
  lactatePoolConcentration,
  lactatePoolPumpRate,
  lactatePoolMassDerivative,
});
