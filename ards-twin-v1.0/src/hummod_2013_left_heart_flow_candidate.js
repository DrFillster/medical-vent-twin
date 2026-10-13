'use strict';

/**
 * HumMod 2012/2013 left-heart coronary-flow candidate.
 *
 * Source equation:
 * nysuloem/HumMod-UTSC-CPG@51d369eb75669e150ef7c61e3ba8bcb1e068aecf
 * Structure/LeftHeart/LeftHeart-Flow.DES (revised 2012-02-19)
 *
 * NOPool concentration remains an explicit input. This module does NOT import
 * the repository's later 2025 VascularEndothelium implementation.
 *
 * Numerical note: source declares an implicit PO2 equation with errorlim 0.17
 * mmHg. This JS candidate uses bounded bisection and exposes solver identity.
 */

const {
  o2ContentToPo2,
}=require('./hummod_hgb_tissue_source_aligned.js');

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'51d369eb75669e150ef7c61e3ba8bcb1e068aecf',
  file:'Structure/LeftHeart/LeftHeart-Flow.DES',
  sourceRevisionDate:'2012-02-19',
  authority:'candidate-not-canonical',
});

const SMALL_CONDUCTANCE_PER_G=0.00670;
const LARGE_CONDUCTANCE_PER_G=0.177508;
const IMPLICIT_ERROR_LIMIT_MMHG=0.17;

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

function hermite(points,x){
  finite(x,'curve input');
  if(x<=points[0].x) return points[0].y+points[0].slope*(x-points[0].x);
  const z=points[points.length-1];
  if(x>=z.x) return z.y+z.slope*(x-z.x);
  let i=0;
  while(i+1<points.length&&x>points[i+1].x)i++;
  const a=points[i],b=points[i+1],h=b.x-a.x,t=(x-a.x)/h;
  return (2*t*t*t-3*t*t+1)*a.y+
    (t*t*t-2*t*t+t)*h*a.slope+
    (-2*t*t*t+3*t*t)*b.y+
    (t*t*t-t*t)*h*b.slope;
}

const SYMPS_ON_CONDUCTANCE=Object.freeze([
  Object.freeze({x:0,y:1.3,slope:0}),
  Object.freeze({x:1,y:1,slope:-0.16}),
  Object.freeze({x:4,y:0.8,slope:0}),
]);
const PO2_ON_CONDUCTANCE=Object.freeze([
  Object.freeze({x:12,y:2,slope:0}),
  Object.freeze({x:17,y:1,slope:-0.04}),
  Object.freeze({x:30,y:0.8,slope:0}),
]);
const ADH_ON_CONDUCTANCE=Object.freeze([
  Object.freeze({x:0.8,y:1,slope:0}),
  Object.freeze({x:3,y:0.1,slope:0}),
]);
const NO_ON_CONDUCTANCE=Object.freeze([
  Object.freeze({x:0.00,y:0.80,slope:0}),
  Object.freeze({x:0.05,y:1.00,slope:6.0}),
  Object.freeze({x:0.10,y:1.25,slope:3.0}),
  Object.freeze({x:0.15,y:1.40,slope:1.0}),
  Object.freeze({x:0.20,y:1.50,slope:0}),
  Object.freeze({x:1.00,y:1.50,slope:0}),
]);
const PO2_ON_AEROBIC_FRACTION=Object.freeze([
  Object.freeze({x:2,y:0,slope:0}),
  Object.freeze({x:10,y:1,slope:0}),
]);
const METABOLISM_ON_CONDUCTANCE=Object.freeze([
  Object.freeze({x:30,y:1,slope:0}),
  Object.freeze({x:100,y:3,slope:0}),
]);

function stateAtPo2(po2,{
  initialLeftHeartMassG,
  largeMultiplier,
  smallMultiplier,
  pressureGradientMmHg,
  alphaReceptorActivity,
  adhPoolLog10Conc,
  noPoolConcentration,
  o2NeedMlPerMin,
  viscosityConductanceEffect,
  anesthesiaVascularConductance,
  vasculatureEffect,
  infarctionEffect,
  arterialO2ContentMlPerMl,
  o2MaxMlPerMl,
  hgbP50,
  hgbScaleForSat,
}){
  const nominalLarge=LARGE_CONDUCTANCE_PER_G*initialLeftHeartMassG;
  const nominalSmall=SMALL_CONDUCTANCE_PER_G*initialLeftHeartMassG;
  const basicLarge=nominalLarge*largeMultiplier;
  const basicSmall=nominalSmall*smallMultiplier;
  const largeVesselConductance=basicLarge*viscosityConductanceEffect;
  const sympsEffect=hermite(SYMPS_ON_CONDUCTANCE,alphaReceptorActivity);
  const adhEffect=hermite(ADH_ON_CONDUCTANCE,adhPoolLog10Conc);
  const noEffect=hermite(NO_ON_CONDUCTANCE,noPoolConcentration);
  const metabolismEffect=hermite(METABOLISM_ON_CONDUCTANCE,o2NeedMlPerMin);
  const po2Effect=hermite(PO2_ON_CONDUCTANCE,po2);
  const smallVesselConductance=
    basicSmall*
    sympsEffect*
    po2Effect*
    adhEffect*
    noEffect*
    metabolismEffect*
    viscosityConductanceEffect*
    anesthesiaVascularConductance*
    vasculatureEffect*
    infarctionEffect;
  const conductance=
    (smallVesselConductance*largeVesselConductance)/
    (smallVesselConductance+largeVesselConductance);
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
    nominalLargeConductance:nominalLarge,
    nominalSmallConductance:nominalSmall,
    basicLargeConductance:basicLarge,
    basicSmallConductance:basicSmall,
    largeVesselConductance,
    smallVesselConductance,
    sympsEffect,
    adhEffect,
    noEffect,
    metabolismEffect,
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

function solveLeftHeartFlow2013({
  arterialPo2MmHg,
  initialLeftHeartMassG,
  largeMultiplier=1,
  smallMultiplier=1,
  pressureGradientMmHg,
  alphaReceptorActivity,
  adhPoolLog10Conc,
  noPoolConcentration,
  o2NeedMlPerMin,
  viscosityConductanceEffect,
  anesthesiaVascularConductance,
  vasculatureEffect,
  infarctionEffect,
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
    ['initialLeftHeartMassG',initialLeftHeartMassG],
    ['largeMultiplier',largeMultiplier],
    ['smallMultiplier',smallMultiplier],
    ['pressureGradientMmHg',pressureGradientMmHg],
    ['alphaReceptorActivity',alphaReceptorActivity],
    ['adhPoolLog10Conc',adhPoolLog10Conc],
    ['noPoolConcentration',noPoolConcentration],
    ['o2NeedMlPerMin',o2NeedMlPerMin],
    ['viscosityConductanceEffect',viscosityConductanceEffect],
    ['anesthesiaVascularConductance',anesthesiaVascularConductance],
    ['vasculatureEffect',vasculatureEffect],
    ['infarctionEffect',infarctionEffect],
    ['arterialO2ContentMlPerMl',arterialO2ContentMlPerMl],
    ['o2MaxMlPerMl',o2MaxMlPerMl],
    ['hgbP50',hgbP50],
    ['hgbScaleForSat',hgbScaleForSat],
    ['plasmaVolumeFraction',plasmaVolumeFraction],
    ['errorLimitMmHg',errorLimitMmHg],
  ].forEach(([k,v])=>finite(v,k));

  nonNegative(arterialPo2MmHg,'arterialPo2MmHg');
  positive(initialLeftHeartMassG,'initialLeftHeartMassG');
  positive(largeMultiplier,'largeMultiplier');
  positive(smallMultiplier,'smallMultiplier');
  nonNegative(pressureGradientMmHg,'pressureGradientMmHg');
  positive(o2MaxMlPerMl,'o2MaxMlPerMl');
  positive(hgbP50,'hgbP50');
  positive(hgbScaleForSat,'hgbScaleForSat');
  positive(errorLimitMmHg,'errorLimitMmHg');
  if(plasmaVolumeFraction<0||plasmaVolumeFraction>1){
    throw new Error('plasmaVolumeFraction must be between 0 and 1');
  }

  const args={
    initialLeftHeartMassG,largeMultiplier,smallMultiplier,
    pressureGradientMmHg,alphaReceptorActivity,adhPoolLog10Conc,
    noPoolConcentration,o2NeedMlPerMin,viscosityConductanceEffect,
    anesthesiaVascularConductance,vasculatureEffect,infarctionEffect,
    arterialO2ContentMlPerMl,o2MaxMlPerMl,hgbP50,hgbScaleForSat,
  };

  let lo=0,hi=arterialPo2MmHg;
  let loState=stateAtPo2(lo,args);
  let hiState=stateAtPo2(hi,args);
  let best=Math.abs(loState.residualMmHg)<=Math.abs(hiState.residualMmHg)
    ?loState:hiState;
  let iterations=0;

  for(;iterations<maxIterations;iterations++){
    const mid=0.5*(lo+hi);
    const s=stateAtPo2(mid,args);
    if(Math.abs(s.residualMmHg)<Math.abs(best.residualMmHg)) best=s;
    if(Math.abs(s.residualMmHg)<=errorLimitMmHg){best=s;break;}
    const loSign=Math.sign(loState.residualMmHg);
    const midSign=Math.sign(s.residualMmHg);
    if(loSign===0){best=loState;break;}
    if(loSign!==midSign){hi=mid;hiState=s;}
    else{lo=mid;loState=s;}
  }

  return Object.freeze({
    schema:'hummod-2013-left-heart-flow-candidate/v1',
    ...best,
    plasmaFlowMlPerMin:best.bloodFlowMlPerMin*plasmaVolumeFraction,
    solver:Object.freeze({
      method:'bounded-bisection',
      equation:'PO2End - PO2 = 0',
      sourceErrorLimitMmHg:IMPLICIT_ERROR_LIMIT_MMHG,
      requestedErrorLimitMmHg:errorLimitMmHg,
      iterations,
      converged:Math.abs(best.residualMmHg)<=errorLimitMmHg,
      exactDesSolverIdentity:false,
    }),
    provenance:SOURCE,
    controlAuthority:false,
  });
}

module.exports=Object.freeze({
  SOURCE,
  SMALL_CONDUCTANCE_PER_G,
  LARGE_CONDUCTANCE_PER_G,
  IMPLICIT_ERROR_LIMIT_MMHG,
  SYMPS_ON_CONDUCTANCE,
  PO2_ON_CONDUCTANCE,
  ADH_ON_CONDUCTANCE,
  NO_ON_CONDUCTANCE,
  PO2_ON_AEROBIC_FRACTION,
  METABOLISM_ON_CONDUCTANCE,
  hermite,
  stateAtPo2,
  solveLeftHeartFlow2013,
});
