'use strict';

const {hermite}=require('./hummod_ards_autonomic_source_aligned.js');
const {o2ContentToPo2}=require('./hummod_hgb_tissue_source_aligned.js');
const {humModSource}=require('./hummod_source_identity.js');

const BASIC_CONDUCTANCE=1.6;
const IMPLICIT_ERROR_LIMIT_MMHG=0.40;
const A2_EFFECT=Object.freeze([
  Object.freeze({x:0,y:1.05,slope:0}),
  Object.freeze({x:1.3,y:1.0,slope:-0.08}),
  Object.freeze({x:3.5,y:0.5,slope:0}),
]);
const SYMPS_EFFECT=Object.freeze([
  Object.freeze({x:0,y:0.3,slope:0}),
  Object.freeze({x:1,y:0,slope:-0.3}),
  Object.freeze({x:5,y:-0.9,slope:0}),
]);
const PO2_EFFECT=Object.freeze([
  Object.freeze({x:10,y:2.0,slope:0}),
  Object.freeze({x:20,y:1.0,slope:0}),
]);
const ADH_EFFECT=Object.freeze([
  Object.freeze({x:0.8,y:1.0,slope:0}),
  Object.freeze({x:3.0,y:0.1,slope:0}),
]);
const SYMPS_DILATE_EFFECT=Object.freeze([
  Object.freeze({x:0,y:0.3,slope:0}),
  Object.freeze({x:1,y:1.0,slope:2.2}),
  Object.freeze({x:4,y:8.0,slope:0}),
]);
const LOCAL_TEMP_EFFECT=Object.freeze([
  Object.freeze({x:10.8,y:-0.8,slope:0}),
  Object.freeze({x:29,y:0,slope:0.1}),
  Object.freeze({x:45,y:4.0,slope:0}),
]);
const LOCAL_TEMP_VS_NA=Object.freeze([
  Object.freeze({x:1.2,y:1.0,slope:0}),
  Object.freeze({x:1.5,y:0.0,slope:0}),
]);
const PO2_AEROBIC=Object.freeze([
  Object.freeze({x:2,y:0,slope:0}),
  Object.freeze({x:20,y:1,slope:0}),
]);

function finite(v,label){if(typeof v!=='number'||!Number.isFinite(v))throw new Error(label+' must be finite');return v;}
function positive(v,label){finite(v,label);if(!(v>0))throw new Error(label+' must be > 0');return v;}

function solveSkinFlow({
  arterialPo2MmHg,pressureGradientMmHg,otherTissueAlphaReceptorActivity,
  a2PoolLog10Conc,adhPoolLog10Conc,hypothalamusSkinFlowNerveActivity,
  skinTempC,o2NeedMlPerMin,viscosityConductanceEffect=1,
  anesthesiaVascularConductance=1,otherTissueVasculatureEffect=1,
  arterialO2ContentMlPerMl,o2MaxMlPerMl,hgbP50,hgbScaleForSat,
  plasmaVolumeFraction,maxIterations=100,
}={}){
  [
    ['arterialPo2MmHg',arterialPo2MmHg],['pressureGradientMmHg',pressureGradientMmHg],
    ['otherTissueAlphaReceptorActivity',otherTissueAlphaReceptorActivity],
    ['a2PoolLog10Conc',a2PoolLog10Conc],['adhPoolLog10Conc',adhPoolLog10Conc],
    ['hypothalamusSkinFlowNerveActivity',hypothalamusSkinFlowNerveActivity],
    ['skinTempC',skinTempC],['o2NeedMlPerMin',o2NeedMlPerMin],
    ['viscosityConductanceEffect',viscosityConductanceEffect],
    ['anesthesiaVascularConductance',anesthesiaVascularConductance],
    ['otherTissueVasculatureEffect',otherTissueVasculatureEffect],
    ['arterialO2ContentMlPerMl',arterialO2ContentMlPerMl],
    ['o2MaxMlPerMl',o2MaxMlPerMl],['hgbP50',hgbP50],['hgbScaleForSat',hgbScaleForSat],
    ['plasmaVolumeFraction',plasmaVolumeFraction],
  ].forEach(([k,v])=>finite(v,k));
  positive(o2MaxMlPerMl,'o2MaxMlPerMl');
  if(plasmaVolumeFraction<0||plasmaVolumeFraction>1)throw new Error('plasmaVolumeFraction must be between 0 and 1');

  const localTempVsNa=hermite(LOCAL_TEMP_VS_NA,hypothalamusSkinFlowNerveActivity);
  const sympsEffect=1+hermite(SYMPS_EFFECT,otherTissueAlphaReceptorActivity)*localTempVsNa;
  const sympsDilateEffect=hermite(SYMPS_DILATE_EFFECT,hypothalamusSkinFlowNerveActivity);
  const localTempEffect=1+hermite(LOCAL_TEMP_EFFECT,skinTempC)*localTempVsNa;
  const a2Effect=hermite(A2_EFFECT,a2PoolLog10Conc);
  const adhEffect=hermite(ADH_EFFECT,adhPoolLog10Conc);

  function state(po2){
    const po2Effect=hermite(PO2_EFFECT,po2);
    const conductance=BASIC_CONDUCTANCE*a2Effect*sympsEffect*po2Effect*adhEffect*
      viscosityConductanceEffect*anesthesiaVascularConductance*otherTissueVasculatureEffect*
      sympsDilateEffect*localTempEffect;
    const bloodFlowMlPerMin=Math.max(pressureGradientMmHg*conductance,0);
    const aerobicFraction=hermite(PO2_AEROBIC,po2);
    const o2UseMlPerMin=o2NeedMlPerMin*aerobicFraction;
    const tissueO2ContentMlPerMl=bloodFlowMlPerMin>0
      ? arterialO2ContentMlPerMl-(o2UseMlPerMin/bloodFlowMlPerMin):0;
    const po2EndMmHg=o2ContentToPo2({
      o2ContentMlPerMl:tissueO2ContentMlPerMl,o2MaxMlPerMl,p50:hgbP50,scaleForSat:hgbScaleForSat,
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
    ...best,a2Effect,sympsEffect,adhEffect,sympsDilateEffect,localTempEffect,localTempVsNa,
    plasmaFlowMlPerMin:best.bloodFlowMlPerMin*plasmaVolumeFraction,
    solver:Object.freeze({method:'bounded-bisection',sourceErrorLimitMmHg:IMPLICIT_ERROR_LIMIT_MMHG,
      iterations,converged:Math.abs(best.residualMmHg)<=IMPLICIT_ERROR_LIMIT_MMHG,exactDesSolverIdentity:false}),
    provenance:Object.freeze({status:'source-aligned-equation-with-explicit-solver-adaptation',
      source:humModSource('Structure/Skin/Skin-Flow.DES','Skin-Flow.Calc'),clinicalValidation:false}),
  });
}

module.exports={BASIC_CONDUCTANCE,IMPLICIT_ERROR_LIMIT_MMHG,A2_EFFECT,SYMPS_EFFECT,PO2_EFFECT,ADH_EFFECT,
  SYMPS_DILATE_EFFECT,LOCAL_TEMP_EFFECT,LOCAL_TEMP_VS_NA,PO2_AEROBIC,solveSkinFlow};
