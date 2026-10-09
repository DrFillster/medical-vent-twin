'use strict';

const {HUMMOD_SOURCE_IDENTITY}=require('./hummod_source_identity.js');
const {hermite}=require('./hummod_ards_autonomic_source_aligned.js');
const {o2ContentToPo2}=require('./hummod_hgb_tissue_source_aligned.js');

const BASIC_CONDUCTANCE=7.2;
const IMPLICIT_ERROR_LIMIT_MMHG=0.38;

const A2_ON_CONDUCTANCE=Object.freeze([
  Object.freeze({x:0,y:1.05,slope:0}),
  Object.freeze({x:1.3,y:1.0,slope:-0.08}),
  Object.freeze({x:3.5,y:0.5,slope:0}),
]);
const SYMPS_ON_CONDUCTANCE=Object.freeze([
  Object.freeze({x:0,y:1.3,slope:0}),
  Object.freeze({x:1,y:1.0,slope:-0.2}),
  Object.freeze({x:4,y:0.5,slope:0}),
]);
const PO2_ON_CONDUCTANCE=Object.freeze([
  Object.freeze({x:0,y:4.0,slope:0}),
  Object.freeze({x:25,y:2.5,slope:-0.2}),
  Object.freeze({x:35,y:1.0,slope:0}),
]);
const ADH_ON_CONDUCTANCE=Object.freeze([
  Object.freeze({x:0.8,y:1.0,slope:0}),
  Object.freeze({x:3.0,y:0.1,slope:0}),
]);
const PO2_ON_AEROBIC_FRACTION=Object.freeze([
  Object.freeze({x:0,y:0,slope:0}),
  Object.freeze({x:15,y:0.2,slope:0.04}),
  Object.freeze({x:20,y:1.0,slope:0}),
]);

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){finite(v,label);if(!(v>0))throw new Error(label+' must be > 0');return v;}
function nonNegative(v,label){finite(v,label);if(v<0)throw new Error(label+' must be >= 0');return v;}

function stateAtPo2(po2,{
  pressureGradientMmHg,
  alphaReceptorActivity,
  a2PoolLog10Conc,
  adhPoolLog10Conc,
  o2NeedMlPerMin,
  metabolicVasodilationEffect,
  viscosityConductanceEffect,
  anesthesiaVascularConductance,
  vasculatureEffect,
  musclePumpingEffect,
  arterialO2ContentMlPerMl,
  o2MaxMlPerMl,
  hgbP50,
  hgbScaleForSat,
}){
  const a2Effect=hermite(A2_ON_CONDUCTANCE,a2PoolLog10Conc);
  const sympsEffect=hermite(SYMPS_ON_CONDUCTANCE,alphaReceptorActivity);
  const adhEffect=hermite(ADH_ON_CONDUCTANCE,adhPoolLog10Conc);
  const po2Effect=hermite(PO2_ON_CONDUCTANCE,po2);
  const conductance=
    BASIC_CONDUCTANCE*
    a2Effect*
    sympsEffect*
    po2Effect*
    adhEffect*
    metabolicVasodilationEffect*
    viscosityConductanceEffect*
    anesthesiaVascularConductance*
    vasculatureEffect*
    musclePumpingEffect;
  const bloodFlowMlPerMin=Math.max(pressureGradientMmHg*conductance,0);
  const aerobicFraction=hermite(PO2_ON_AEROBIC_FRACTION,po2);
  const o2UseMlPerMin=o2NeedMlPerMin*aerobicFraction;
  const tissueO2ContentMlPerMl=bloodFlowMlPerMin>0
    ? arterialO2ContentMlPerMl-(o2UseMlPerMin/bloodFlowMlPerMin)
    : 0;
  const po2EndMmHg=o2ContentToPo2({
    o2ContentMlPerMl:tissueO2ContentMlPerMl,
    o2MaxMlPerMl,
    p50:hgbP50,
    scaleForSat:hgbScaleForSat,
  });
  return Object.freeze({
    po2MmHg:po2,
    a2Effect,
    sympsEffect,
    adhEffect,
    po2Effect,
    conductance,
    bloodFlowMlPerMin,
    aerobicFraction,
    o2UseMlPerMin,
    tissueO2ContentMlPerMl,
    po2EndMmHg,
    residualMmHg:po2EndMmHg-po2,
  });
}

function solveSkeletalMuscleFlow({
  arterialPo2MmHg,
  pressureGradientMmHg,
  alphaReceptorActivity,
  a2PoolLog10Conc,
  adhPoolLog10Conc,
  o2NeedMlPerMin,
  metabolicVasodilationEffect=1,
  viscosityConductanceEffect=1,
  anesthesiaVascularConductance=1,
  vasculatureEffect=1,
  musclePumpingEffect=1,
  arterialO2ContentMlPerMl,
  o2MaxMlPerMl,
  hgbP50,
  hgbScaleForSat,
  plasmaVolumeFraction,
  errorLimitMmHg=IMPLICIT_ERROR_LIMIT_MMHG,
  maxIterations=100,
}={}){
  [
    ['arterialPo2MmHg',arterialPo2MmHg],
    ['pressureGradientMmHg',pressureGradientMmHg],
    ['alphaReceptorActivity',alphaReceptorActivity],
    ['a2PoolLog10Conc',a2PoolLog10Conc],
    ['adhPoolLog10Conc',adhPoolLog10Conc],
    ['o2NeedMlPerMin',o2NeedMlPerMin],
    ['metabolicVasodilationEffect',metabolicVasodilationEffect],
    ['viscosityConductanceEffect',viscosityConductanceEffect],
    ['anesthesiaVascularConductance',anesthesiaVascularConductance],
    ['vasculatureEffect',vasculatureEffect],
    ['musclePumpingEffect',musclePumpingEffect],
    ['arterialO2ContentMlPerMl',arterialO2ContentMlPerMl],
    ['o2MaxMlPerMl',o2MaxMlPerMl],
    ['hgbP50',hgbP50],
    ['hgbScaleForSat',hgbScaleForSat],
    ['plasmaVolumeFraction',plasmaVolumeFraction],
    ['errorLimitMmHg',errorLimitMmHg],
  ].forEach(([k,v])=>finite(v,k));
  nonNegative(arterialPo2MmHg,'arterialPo2MmHg');
  nonNegative(o2NeedMlPerMin,'o2NeedMlPerMin');
  positive(o2MaxMlPerMl,'o2MaxMlPerMl');
  positive(hgbP50,'hgbP50');
  positive(hgbScaleForSat,'hgbScaleForSat');
  positive(errorLimitMmHg,'errorLimitMmHg');
  if(plasmaVolumeFraction<0||plasmaVolumeFraction>1){
    throw new Error('plasmaVolumeFraction must be between 0 and 1');
  }

  const args={
    pressureGradientMmHg,
    alphaReceptorActivity,
    a2PoolLog10Conc,
    adhPoolLog10Conc,
    o2NeedMlPerMin,
    metabolicVasodilationEffect,
    viscosityConductanceEffect,
    anesthesiaVascularConductance,
    vasculatureEffect,
    musclePumpingEffect,
    arterialO2ContentMlPerMl,
    o2MaxMlPerMl,
    hgbP50,
    hgbScaleForSat,
  };

  let lo=0,hi=arterialPo2MmHg;
  let loState=stateAtPo2(lo,args);
  let hiState=stateAtPo2(hi,args);
  let best=Math.abs(loState.residualMmHg)<=Math.abs(hiState.residualMmHg)?loState:hiState;
  let iterations=0;
  for(;iterations<maxIterations;iterations++){
    const mid=(lo+hi)/2;
    const s=stateAtPo2(mid,args);
    if(Math.abs(s.residualMmHg)<Math.abs(best.residualMmHg)) best=s;
    if(Math.abs(s.residualMmHg)<=errorLimitMmHg){best=s;break;}
    const ls=Math.sign(loState.residualMmHg);
    const ms=Math.sign(s.residualMmHg);
    if(ls===0){best=loState;break;}
    if(ls!==ms){hi=mid;hiState=s;}
    else{lo=mid;loState=s;}
  }

  return Object.freeze({
    ...best,
    plasmaFlowMlPerMin:best.bloodFlowMlPerMin*plasmaVolumeFraction,
    solver:Object.freeze({
      method:'bounded-bisection',
      equation:'PO2End - PO2 = 0',
      sourceSearchMinMmHg:0,
      sourceSearchMaxMmHg:arterialPo2MmHg,
      sourceErrorLimitMmHg:IMPLICIT_ERROR_LIMIT_MMHG,
      requestedErrorLimitMmHg:errorLimitMmHg,
      iterations,
      converged:Math.abs(best.residualMmHg)<=errorLimitMmHg,
      exactDesSolverIdentity:false,
    }),
    provenance:Object.freeze({
      status:'source-aligned-equation-with-explicit-solver-adaptation',
      sourceRepository:HUMMOD_SOURCE_IDENTITY.canonicalRepository,
      sourceRevision:HUMMOD_SOURCE_IDENTITY.canonicalRevision,
      sourceStructure:'SkeletalMuscle-Flow',
      clinicalValidation:false,
    }),
  });
}

module.exports={
  BASIC_CONDUCTANCE,
  IMPLICIT_ERROR_LIMIT_MMHG,
  A2_ON_CONDUCTANCE,
  SYMPS_ON_CONDUCTANCE,
  PO2_ON_CONDUCTANCE,
  ADH_ON_CONDUCTANCE,
  PO2_ON_AEROBIC_FRACTION,
  stateAtPo2,
  solveSkeletalMuscleFlow,
};
