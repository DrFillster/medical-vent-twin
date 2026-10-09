'use strict';

const {HUMMOD_SOURCE_IDENTITY,humModSource}=require('./hummod_source_identity.js');
const {hermite}=require('./hummod_ards_autonomic_source_aligned.js');
const {o2ContentToPo2}=require('./hummod_hgb_tissue_source_aligned.js');

const COMMON_A2=Object.freeze([
  Object.freeze({x:0,y:1.05,slope:0}),
  Object.freeze({x:1.3,y:1.0,slope:-0.08}),
  Object.freeze({x:3.5,y:0.5,slope:0}),
]);
const COMMON_SYMPS=Object.freeze([
  Object.freeze({x:0,y:1.3,slope:0}),
  Object.freeze({x:1,y:1.0,slope:-0.3}),
  Object.freeze({x:5,y:0.1,slope:0}),
]);
const COMMON_PO2_CONDUCTANCE=Object.freeze([
  Object.freeze({x:10,y:2.0,slope:0}),
  Object.freeze({x:30,y:1.0,slope:0}),
]);
const COMMON_ADH=Object.freeze([
  Object.freeze({x:0.8,y:1.0,slope:0}),
  Object.freeze({x:3.0,y:0.1,slope:0}),
]);
const COMMON_AEROBIC=Object.freeze([
  Object.freeze({x:2,y:0,slope:0}),
  Object.freeze({x:10,y:1,slope:0}),
]);

const SIMPLE_ORGAN_FLOW_CONFIG=Object.freeze({
  giTract:Object.freeze({
    structure:'GITract-Flow',
    basicConductance:11.2,
    implicitErrorLimitMmHg:0.54,
    source:humModSource('Structure/GITract/GITract-Flow.DES','GITract-Flow.Calc'),
  }),
  fat:Object.freeze({
    structure:'Fat-Flow',
    basicConductance:2.7,
    implicitErrorLimitMmHg:0.52,
    source:humModSource('Structure/Fat/Fat-Flow.DES','Fat-Flow.Calc'),
  }),
  otherTissue:Object.freeze({
    structure:'OtherTissue-Flow',
    basicConductance:4.2,
    implicitErrorLimitMmHg:0.45,
    source:humModSource('Structure/OtherTissue/OtherTissue-Flow.DES','OtherTissue-Flow.Calc'),
  }),
});

function finite(v,label){if(typeof v!=='number'||!Number.isFinite(v))throw new Error(label+' must be finite');return v;}
function positive(v,label){finite(v,label);if(!(v>0))throw new Error(label+' must be > 0');return v;}
function nonNegative(v,label){finite(v,label);if(v<0)throw new Error(label+' must be >= 0');return v;}

function solveSimpleOrganFlow({
  organ,
  arterialPo2MmHg,
  pressureGradientMmHg,
  alphaReceptorActivity,
  a2PoolLog10Conc,
  adhPoolLog10Conc,
  o2NeedMlPerMin,
  viscosityConductanceEffect=1,
  anesthesiaVascularConductance=1,
  vasculatureEffect=1,
  arterialO2ContentMlPerMl,
  o2MaxMlPerMl,
  hgbP50,
  hgbScaleForSat,
  plasmaVolumeFraction,
  maxIterations=100,
}={}){
  const cfg=SIMPLE_ORGAN_FLOW_CONFIG[organ];
  if(!cfg) throw new Error('unsupported simple HumMod organ flow: '+organ);
  [
    ['arterialPo2MmHg',arterialPo2MmHg],['pressureGradientMmHg',pressureGradientMmHg],
    ['alphaReceptorActivity',alphaReceptorActivity],['a2PoolLog10Conc',a2PoolLog10Conc],
    ['adhPoolLog10Conc',adhPoolLog10Conc],['o2NeedMlPerMin',o2NeedMlPerMin],
    ['viscosityConductanceEffect',viscosityConductanceEffect],
    ['anesthesiaVascularConductance',anesthesiaVascularConductance],
    ['vasculatureEffect',vasculatureEffect],['arterialO2ContentMlPerMl',arterialO2ContentMlPerMl],
    ['o2MaxMlPerMl',o2MaxMlPerMl],['hgbP50',hgbP50],['hgbScaleForSat',hgbScaleForSat],
    ['plasmaVolumeFraction',plasmaVolumeFraction],
  ].forEach(([k,v])=>finite(v,k));
  nonNegative(arterialPo2MmHg,'arterialPo2MmHg');
  nonNegative(o2NeedMlPerMin,'o2NeedMlPerMin');
  positive(o2MaxMlPerMl,'o2MaxMlPerMl');
  if(plasmaVolumeFraction<0||plasmaVolumeFraction>1) throw new Error('plasmaVolumeFraction must be between 0 and 1');

  function state(po2){
    const a2Effect=hermite(COMMON_A2,a2PoolLog10Conc);
    const sympsEffect=hermite(COMMON_SYMPS,alphaReceptorActivity);
    const po2Effect=hermite(COMMON_PO2_CONDUCTANCE,po2);
    const adhEffect=hermite(COMMON_ADH,adhPoolLog10Conc);
    const conductance=cfg.basicConductance*a2Effect*sympsEffect*po2Effect*adhEffect*
      viscosityConductanceEffect*anesthesiaVascularConductance*vasculatureEffect;
    const bloodFlowMlPerMin=Math.max(pressureGradientMmHg*conductance,0);
    const aerobicFraction=hermite(COMMON_AEROBIC,po2);
    const o2UseMlPerMin=o2NeedMlPerMin*aerobicFraction;
    const tissueO2ContentMlPerMl=bloodFlowMlPerMin>0
      ? arterialO2ContentMlPerMl-(o2UseMlPerMin/bloodFlowMlPerMin)
      : 0;
    const po2EndMmHg=o2ContentToPo2({
      o2ContentMlPerMl:tissueO2ContentMlPerMl,
      o2MaxMlPerMl,p50:hgbP50,scaleForSat:hgbScaleForSat,
    });
    return {po2MmHg:po2,conductance,bloodFlowMlPerMin,aerobicFraction,o2UseMlPerMin,
      tissueO2ContentMlPerMl,po2EndMmHg,residualMmHg:po2EndMmHg-po2,
      a2Effect,sympsEffect,po2Effect,adhEffect};
  }

  let lo=0,hi=arterialPo2MmHg;
  let ls=state(lo),hs=state(hi);
  let best=Math.abs(ls.residualMmHg)<=Math.abs(hs.residualMmHg)?ls:hs;
  let iterations=0;
  for(;iterations<maxIterations;iterations++){
    const mid=(lo+hi)/2;
    const s=state(mid);
    if(Math.abs(s.residualMmHg)<Math.abs(best.residualMmHg)) best=s;
    if(Math.abs(s.residualMmHg)<=cfg.implicitErrorLimitMmHg){best=s;break;}
    if(Math.sign(ls.residualMmHg)!==Math.sign(s.residualMmHg)){hi=mid;hs=s;}
    else{lo=mid;ls=s;}
  }

  return Object.freeze({
    ...best,
    plasmaFlowMlPerMin:best.bloodFlowMlPerMin*plasmaVolumeFraction,
    solver:Object.freeze({
      method:'bounded-bisection',
      sourceErrorLimitMmHg:cfg.implicitErrorLimitMmHg,
      iterations,
      converged:Math.abs(best.residualMmHg)<=cfg.implicitErrorLimitMmHg,
      exactDesSolverIdentity:false,
    }),
    provenance:Object.freeze({
      status:'source-aligned-equation-with-explicit-solver-adaptation',
      sourceRepository:HUMMOD_SOURCE_IDENTITY.canonicalRepository,
      sourceRevision:HUMMOD_SOURCE_IDENTITY.canonicalRevision,
      sourceStructure:cfg.structure,
      source:cfg.source,
      clinicalValidation:false,
    }),
  });
}

module.exports={
  COMMON_A2,COMMON_SYMPS,COMMON_PO2_CONDUCTANCE,COMMON_ADH,COMMON_AEROBIC,
  SIMPLE_ORGAN_FLOW_CONFIG,solveSimpleOrganFlow,
};
