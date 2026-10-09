'use strict';

const {hermite}=require('./hummod_ards_autonomic_source_aligned.js');
const {o2ContentToPo2}=require('./hummod_hgb_tissue_source_aligned.js');
const {humModSource}=require('./hummod_source_identity.js');

const BASIC_CONDUCTANCE=1.1;
const IMPLICIT_ERROR_LIMIT_MMHG=0.34;
const A2=Object.freeze([{x:0,y:1.05,slope:0},{x:1.3,y:1,slope:-0.08},{x:3.5,y:0.5,slope:0}].map(Object.freeze));
const SYMPS=Object.freeze([{x:0,y:1.3,slope:0},{x:1,y:1,slope:-0.3},{x:5,y:0.1,slope:0}].map(Object.freeze));
const PO2=Object.freeze([{x:10,y:2,slope:0},{x:30,y:1,slope:0}].map(Object.freeze));
const ADH=Object.freeze([{x:0.8,y:1,slope:0},{x:3,y:0.1,slope:0}].map(Object.freeze));
const METABOLISM=Object.freeze([{x:6,y:1,slope:0},{x:12,y:1.3,slope:0.08},{x:400,y:24,slope:0}].map(Object.freeze));
const AEROBIC=Object.freeze([{x:2,y:0,slope:0},{x:10,y:1,slope:0}].map(Object.freeze));

function finite(v,l){if(typeof v!=='number'||!Number.isFinite(v))throw new Error(l+' must be finite');return v;}

function solveRespiratoryMuscleFlow({
  arterialPo2MmHg,pressureGradientMmHg,alphaReceptorActivity,a2PoolLog10Conc,adhPoolLog10Conc,
  o2NeedMlPerMin,viscosityConductanceEffect=1,anesthesiaVascularConductance=1,vasculatureEffect=1,
  arterialO2ContentMlPerMl,o2MaxMlPerMl,hgbP50,hgbScaleForSat,plasmaVolumeFraction,maxIterations=100,
}={}){
  [
    ['arterialPo2MmHg',arterialPo2MmHg],['pressureGradientMmHg',pressureGradientMmHg],
    ['alphaReceptorActivity',alphaReceptorActivity],['a2PoolLog10Conc',a2PoolLog10Conc],
    ['adhPoolLog10Conc',adhPoolLog10Conc],['o2NeedMlPerMin',o2NeedMlPerMin],
    ['viscosityConductanceEffect',viscosityConductanceEffect],['anesthesiaVascularConductance',anesthesiaVascularConductance],
    ['vasculatureEffect',vasculatureEffect],['arterialO2ContentMlPerMl',arterialO2ContentMlPerMl],
    ['o2MaxMlPerMl',o2MaxMlPerMl],['hgbP50',hgbP50],['hgbScaleForSat',hgbScaleForSat],
    ['plasmaVolumeFraction',plasmaVolumeFraction],
  ].forEach(([k,v])=>finite(v,k));
  if(plasmaVolumeFraction<0||plasmaVolumeFraction>1)throw new Error('plasmaVolumeFraction must be between 0 and 1');
  const a2Effect=hermite(A2,a2PoolLog10Conc),sympsEffect=hermite(SYMPS,alphaReceptorActivity),
    adhEffect=hermite(ADH,adhPoolLog10Conc),metabolismEffect=hermite(METABOLISM,o2NeedMlPerMin);

  function state(po2){
    const po2Effect=hermite(PO2,po2);
    const conductance=BASIC_CONDUCTANCE*a2Effect*sympsEffect*po2Effect*adhEffect*metabolismEffect*
      viscosityConductanceEffect*anesthesiaVascularConductance*vasculatureEffect;
    const bloodFlowMlPerMin=Math.max(pressureGradientMmHg*conductance,0);
    const aerobicFraction=hermite(AEROBIC,po2),o2UseMlPerMin=o2NeedMlPerMin*aerobicFraction;
    const tissueO2ContentMlPerMl=bloodFlowMlPerMin>0?arterialO2ContentMlPerMl-o2UseMlPerMin/bloodFlowMlPerMin:0;
    const po2EndMmHg=o2ContentToPo2({o2ContentMlPerMl:tissueO2ContentMlPerMl,o2MaxMlPerMl,p50:hgbP50,scaleForSat:hgbScaleForSat});
    return {po2MmHg:po2,po2Effect,conductance,bloodFlowMlPerMin,aerobicFraction,o2UseMlPerMin,
      tissueO2ContentMlPerMl,po2EndMmHg,residualMmHg:po2EndMmHg-po2};
  }
  let lo=0,hi=arterialPo2MmHg,ls=state(0),hs=state(arterialPo2MmHg),best=Math.abs(ls.residualMmHg)<=Math.abs(hs.residualMmHg)?ls:hs,iterations=0;
  for(;iterations<maxIterations;iterations++){
    const mid=(lo+hi)/2,s=state(mid);
    if(Math.abs(s.residualMmHg)<Math.abs(best.residualMmHg))best=s;
    if(Math.abs(s.residualMmHg)<=IMPLICIT_ERROR_LIMIT_MMHG){best=s;break;}
    if(Math.sign(ls.residualMmHg)!==Math.sign(s.residualMmHg)){hi=mid;hs=s;}else{lo=mid;ls=s;}
  }
  return Object.freeze({...best,a2Effect,sympsEffect,adhEffect,metabolismEffect,
    plasmaFlowMlPerMin:best.bloodFlowMlPerMin*plasmaVolumeFraction,
    solver:Object.freeze({method:'bounded-bisection',sourceErrorLimitMmHg:IMPLICIT_ERROR_LIMIT_MMHG,iterations,
      converged:Math.abs(best.residualMmHg)<=IMPLICIT_ERROR_LIMIT_MMHG,exactDesSolverIdentity:false}),
    provenance:Object.freeze({status:'source-aligned-equation-with-explicit-solver-adaptation',
      source:humModSource('Structure/RespiratoryMuscle/RespiratoryMuscle-Flow.DES','RespiratoryMuscle-Flow.Calc'),clinicalValidation:false})});
}

module.exports={BASIC_CONDUCTANCE,IMPLICIT_ERROR_LIMIT_MMHG,A2,SYMPS,PO2,ADH,METABOLISM,AEROBIC,solveRespiratoryMuscleFlow};
