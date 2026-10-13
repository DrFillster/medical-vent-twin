'use strict';

/**
 * HumMod 2013 systemic lactate-pool provider contract.
 *
 * Sources:
 * nysuloem/HumMod-UTSC-CPG@93ee1b30b74a0f2e60a2c961bbf569b4c8237611
 * - Structure/Lactate/LacPool.DES
 * - Structure/Sizing/Sizing-LactatePool.DES
 *
 * Initial concentration is 1 mEq/L. Current pool mass requires all source
 * organ lactate outfluxes plus IV/pump terms.
 */

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'93ee1b30b74a0f2e60a2c961bbf569b4c8237611',
  authority:'candidate-not-canonical',
});

const INITIAL_LACTATE_MEQ_PER_L=1.0;
const MEQ_PER_ML_TO_MG_DL=9008.0;
const ERROR_LIMIT_MEQ=0.150;

const OUTFLOW_KEYS=Object.freeze([
  'bone',
  'brain',
  'fat',
  'giTract',
  'rightKidney',
  'leftKidney',
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

function initialLactatePool2013({initialEcfvMl}={}){
  positive(initialEcfvMl,'initialEcfvMl');
  const initialEcfvL=initialEcfvMl/1000;
  const initialMassMeq=INITIAL_LACTATE_MEQ_PER_L*initialEcfvL;
  return Object.freeze({
    initialEcfvMl,
    initialEcfvL,
    initialConcentrationMeqPerL:INITIAL_LACTATE_MEQ_PER_L,
    initialMassMeq,
    controlAuthority:false,
    provenance:SOURCE,
  });
}

function lactatePoolConcentration2013({
  massMeq,
  ecfvMl,
}={}){
  nonNegative(massMeq,'massMeq');
  positive(ecfvMl,'ecfvMl');
  const concentrationMeqPerMl=massMeq/ecfvMl;
  return Object.freeze({
    massMeq,
    ecfvMl,
    concentrationMeqPerMl,
    concentrationMeqPerL:1000*concentrationMeqPerMl,
    concentrationMgDl:MEQ_PER_ML_TO_MG_DL*concentrationMeqPerMl,
    controlAuthority:false,
    provenance:SOURCE,
  });
}

function lactatePoolMassDerivative2013({
  tissueOutflowsMeqPerMin,
  ivDripLactateRateMeqPerMin,
  pumpRateMeqPerMin,
}={}){
  if(!tissueOutflowsMeqPerMin ||
     typeof tissueOutflowsMeqPerMin!=='object' ||
     Array.isArray(tissueOutflowsMeqPerMin)){
    throw new Error('tissueOutflowsMeqPerMin object is required');
  }
  finite(ivDripLactateRateMeqPerMin,'ivDripLactateRateMeqPerMin');
  finite(pumpRateMeqPerMin,'pumpRateMeqPerMin');

  const missing=OUTFLOW_KEYS.filter(k=>tissueOutflowsMeqPerMin[k]==null);
  if(missing.length){
    throw new Error('missing source lactate outflows: '+missing.join(', '));
  }

  let tissueOutflowTotalMeqPerMin=0;
  for(const key of OUTFLOW_KEYS){
    finite(tissueOutflowsMeqPerMin[key],key+'OutflowMeqPerMin');
    tissueOutflowTotalMeqPerMin+=tissueOutflowsMeqPerMin[key];
  }

  return Object.freeze({
    tissueOutflowTotalMeqPerMin,
    ivDripLactateRateMeqPerMin,
    pumpRateMeqPerMin,
    changeMeqPerMin:
      tissueOutflowTotalMeqPerMin+
      ivDripLactateRateMeqPerMin+
      pumpRateMeqPerMin,
    controlAuthority:false,
    provenance:SOURCE,
  });
}

const READINESS=Object.freeze({
  initialPool:'parallel-source-complete-if-initial-ECFV-is-supplied',
  currentConcentration:'blocked-on-whole-body-lactate-outflux-network',
  requiredLiveProviders:Object.freeze([
    ...OUTFLOW_KEYS.map(k=>k+' lactate outflux'),
    'IVDrip.LacRate',
    'LacPool PumpRate',
    'ECFV.Vol',
  ]),
  fixedOneMeqPerLSubstitutionAllowed:false,
  olderLactatePoolModuleInterchangeable:false,
  generationMismatch:Object.freeze({
    olderInitialMassMeq:15,
    hummod2013Initialization:'1 mEq/L times Sizing-ECFV volume',
    olderRenalOutflow:'collapsed kidney outflow',
    hummod2013RenalOutflow:'separate left and right kidney outflows',
  }),
});

module.exports=Object.freeze({
  SOURCE,
  INITIAL_LACTATE_MEQ_PER_L,
  MEQ_PER_ML_TO_MG_DL,
  ERROR_LIMIT_MEQ,
  OUTFLOW_KEYS,
  READINESS,
  initialLactatePool2013,
  lactatePoolConcentration2013,
  lactatePoolMassDerivative2013,
});
