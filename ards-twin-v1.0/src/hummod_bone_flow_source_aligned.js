'use strict';

const {hermite}=require('./hummod_ards_autonomic_source_aligned.js');
const {o2ContentToPo2}=require('./hummod_hgb_tissue_source_aligned.js');
const {humModSource}=require('./hummod_source_identity.js');
const {
  COMMON_A2,
  COMMON_SYMPS,
  COMMON_PO2_CONDUCTANCE,
  COMMON_ADH,
  COMMON_AEROBIC,
}=require('./hummod_simple_organ_flow_source_aligned.js');

const BONE_MASS_FRACTION_OF_INITIAL_OTHER_MASS=0.389;
const CONDUCTANCE_PER_GRAM=0.000424;
const IMPLICIT_ERROR_LIMIT_MMHG=0.40;

function finite(v,label){if(typeof v!=='number'||!Number.isFinite(v))throw new Error(label+' must be finite');return v;}
function positive(v,label){finite(v,label);if(!(v>0))throw new Error(label+' must be > 0');return v;}

function initialBoneMassG(weightInitialOtherMassG){
  positive(weightInitialOtherMassG,'weightInitialOtherMassG');
  return BONE_MASS_FRACTION_OF_INITIAL_OTHER_MASS*weightInitialOtherMassG;
}

function solveBoneFlow({
  weightInitialOtherMassG,
  multiplier=1,
  arterialPo2MmHg,
  pressureGradientMmHg,
  otherTissueAlphaReceptorActivity,
  a2PoolLog10Conc,
  adhPoolLog10Conc,
  o2NeedMlPerMin,
  viscosityConductanceEffect=1,
  anesthesiaVascularConductance=1,
  boneVasculatureEffect=1,
  arterialO2ContentMlPerMl,
  o2MaxMlPerMl,
  hgbP50,
  hgbScaleForSat,
  plasmaVolumeFraction,
  maxIterations=100,
}={}){
  [
    ['multiplier',multiplier],['arterialPo2MmHg',arterialPo2MmHg],
    ['pressureGradientMmHg',pressureGradientMmHg],
    ['otherTissueAlphaReceptorActivity',otherTissueAlphaReceptorActivity],
    ['a2PoolLog10Conc',a2PoolLog10Conc],['adhPoolLog10Conc',adhPoolLog10Conc],
    ['o2NeedMlPerMin',o2NeedMlPerMin],['viscosityConductanceEffect',viscosityConductanceEffect],
    ['anesthesiaVascularConductance',anesthesiaVascularConductance],
    ['boneVasculatureEffect',boneVasculatureEffect],['arterialO2ContentMlPerMl',arterialO2ContentMlPerMl],
    ['o2MaxMlPerMl',o2MaxMlPerMl],['hgbP50',hgbP50],['hgbScaleForSat',hgbScaleForSat],
    ['plasmaVolumeFraction',plasmaVolumeFraction],
  ].forEach(([k,v])=>finite(v,k));
  positive(weightInitialOtherMassG,'weightInitialOtherMassG');
  positive(multiplier,'multiplier');
  positive(o2MaxMlPerMl,'o2MaxMlPerMl');
  if(plasmaVolumeFraction<0||plasmaVolumeFraction>1)throw new Error('plasmaVolumeFraction must be between 0 and 1');

  const boneInitialMassG=initialBoneMassG(weightInitialOtherMassG);
  const initialConductance=CONDUCTANCE_PER_GRAM*boneInitialMassG;
  const basicConductance=initialConductance*multiplier;
  const a2Effect=hermite(COMMON_A2,a2PoolLog10Conc);
  const sympsEffect=hermite(COMMON_SYMPS,otherTissueAlphaReceptorActivity);
  const adhEffect=hermite(COMMON_ADH,adhPoolLog10Conc);

  function state(po2){
    const po2Effect=hermite(COMMON_PO2_CONDUCTANCE,po2);
    const conductance=basicConductance*a2Effect*sympsEffect*po2Effect*adhEffect*
      viscosityConductanceEffect*anesthesiaVascularConductance*boneVasculatureEffect;
    const bloodFlowMlPerMin=Math.max(pressureGradientMmHg*conductance,0);
    const aerobicFraction=hermite(COMMON_AEROBIC,po2);
    const o2UseMlPerMin=o2NeedMlPerMin*aerobicFraction;
    const tissueO2ContentMlPerMl=bloodFlowMlPerMin>0
      ? arterialO2ContentMlPerMl-o2UseMlPerMin/bloodFlowMlPerMin
      : 0;
    const po2EndMmHg=o2ContentToPo2({
      o2ContentMlPerMl:tissueO2ContentMlPerMl,
      o2MaxMlPerMl,p50:hgbP50,scaleForSat:hgbScaleForSat,
    });
    return {po2MmHg:po2,po2Effect,conductance,bloodFlowMlPerMin,aerobicFraction,o2UseMlPerMin,
      tissueO2ContentMlPerMl,po2EndMmHg,residualMmHg:po2EndMmHg-po2};
  }

  let lo=0,hi=arterialPo2MmHg,ls=state(0),hs=state(arterialPo2MmHg);
  let best=Math.abs(ls.residualMmHg)<=Math.abs(hs.residualMmHg)?ls:hs;
  let iterations=0;
  for(;iterations<maxIterations;iterations++){
    const mid=(lo+hi)/2,s=state(mid);
    if(Math.abs(s.residualMmHg)<Math.abs(best.residualMmHg))best=s;
    if(Math.abs(s.residualMmHg)<=IMPLICIT_ERROR_LIMIT_MMHG){best=s;break;}
    if(Math.sign(ls.residualMmHg)!==Math.sign(s.residualMmHg)){hi=mid;hs=s;}else{lo=mid;ls=s;}
  }

  return Object.freeze({
    ...best,
    boneInitialMassG,
    initialConductance,
    basicConductance,
    a2Effect,sympsEffect,adhEffect,
    plasmaFlowMlPerMin:best.bloodFlowMlPerMin*plasmaVolumeFraction,
    solver:Object.freeze({
      method:'bounded-bisection',
      sourceErrorLimitMmHg:IMPLICIT_ERROR_LIMIT_MMHG,
      iterations,
      converged:Math.abs(best.residualMmHg)<=IMPLICIT_ERROR_LIMIT_MMHG,
      exactDesSolverIdentity:false,
    }),
    provenance:Object.freeze({
      status:'source-aligned-equation-with-explicit-solver-adaptation',
      boneSize:humModSource('Structure/Bone/Bone-Size.DES','Bone-Size.Initialize'),
      boneFlow:humModSource('Structure/Bone/Bone-Flow.DES','Bone-Flow.Calc'),
      clinicalValidation:false,
    }),
  });
}

module.exports={
  BONE_MASS_FRACTION_OF_INITIAL_OTHER_MASS,
  CONDUCTANCE_PER_GRAM,
  IMPLICIT_ERROR_LIMIT_MMHG,
  initialBoneMassG,
  solveBoneFlow,
};
