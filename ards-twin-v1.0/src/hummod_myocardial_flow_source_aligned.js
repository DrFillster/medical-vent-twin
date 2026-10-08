'use strict';

// Source-aligned HumMod myocardial flow / tissue-PO2 implicit relation.
// Equations and curves are from:
// riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
// Structure/LeftHeart/LeftHeart-Flow.DES
// Structure/RightHeart/RightHeart-Flow.DES
//
// Numerical note: HumMod declares an implicit equation with errorlim=0.17.
// The exact DES 2005 root-finding implementation is not available here.
// This module solves the same equation by bounded bisection and exposes that
// solver choice explicitly; equation fidelity and solver identity are separate.

const {
  o2ContentToPo2,
}=require('./hummod_hgb_tissue_source_aligned.js');

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
  if(x<=points[0].x) return points[0].y + points[0].slope*(x-points[0].x);
  const last=points[points.length-1];
  if(x>=last.x) return last.y + last.slope*(x-last.x);
  let i=0;
  while(i+1<points.length && x>points[i+1].x) i++;
  const a=points[i], b=points[i+1];
  const h=b.x-a.x;
  const t=(x-a.x)/h;
  const h00=2*t*t*t-3*t*t+1;
  const h10=t*t*t-2*t*t+t;
  const h01=-2*t*t*t+3*t*t;
  const h11=t*t*t-t*t;
  return h00*a.y+h10*h*a.slope+h01*b.y+h11*h*b.slope;
}

const HEART_FLOW_CONFIG=Object.freeze({
  left:Object.freeze({smallVesselBasicConductance:2.2,largeVesselBasicConductance:50,initialPo2MmHg:16.8}),
  right:Object.freeze({smallVesselBasicConductance:0.4,largeVesselBasicConductance:10,initialPo2MmHg:17.1}),
});
const IMPLICIT_ERROR_LIMIT_MMHG=0.17;

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
const PO2_ON_AEROBIC_FRACTION=Object.freeze([
  Object.freeze({x:2,y:0,slope:0}),
  Object.freeze({x:10,y:1,slope:0}),
]);
const METABOLISM_ON_CONDUCTANCE=Object.freeze([
  Object.freeze({x:30,y:1,slope:0}),
  Object.freeze({x:100,y:3,slope:0}),
]);

function stateAtPo2(po2,{
  side,
  pressureGradientMmHg,
  alphaReceptorActivity,
  adhPoolLog10Conc,
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
  if(side!=='left'&&side!=='right') throw new Error('side must be left or right');
  const cfg=HEART_FLOW_CONFIG[side];
  const largeVesselConductance=
    cfg.largeVesselBasicConductance*viscosityConductanceEffect;
  const sympsEffect=hermite(SYMPS_ON_CONDUCTANCE,alphaReceptorActivity);
  const adhEffect=hermite(ADH_ON_CONDUCTANCE,adhPoolLog10Conc);
  const metabolismEffect=hermite(METABOLISM_ON_CONDUCTANCE,o2NeedMlPerMin);
  const po2Effect=hermite(PO2_ON_CONDUCTANCE,po2);
  const smallVesselConductance=
    cfg.smallVesselBasicConductance*
    sympsEffect*
    po2Effect*
    adhEffect*
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
    largeVesselConductance,
    sympsEffect,
    adhEffect,
    metabolismEffect,
    po2Effect,
    smallVesselConductance,
    conductance,
    bloodFlowMlPerMin,
    aerobicFraction,
    o2UseMlPerMin,
    tissueO2ContentMlPerMl,
    po2EndMmHg,
    residualMmHg:po2EndMmHg-po2,
  });
}

function solveMyocardialFlow({
  side,
  arterialPo2MmHg,
  pressureGradientMmHg,
  alphaReceptorActivity,
  adhPoolLog10Conc,
  o2NeedMlPerMin,
  viscosityConductanceEffect=1,
  anesthesiaVascularConductance=1,
  vasculatureEffect=1,
  infarctionEffect=1,
  arterialO2ContentMlPerMl,
  o2MaxMlPerMl,
  hgbP50,
  hgbScaleForSat,
  plasmaVolumeFraction,
  errorLimitMmHg=IMPLICIT_ERROR_LIMIT_MMHG,
  maxIterations=100,
}={}){
  if(side!=='left'&&side!=='right') throw new Error('side must be left or right');
  [
    ['arterialPo2MmHg',arterialPo2MmHg],
    ['pressureGradientMmHg',pressureGradientMmHg],
    ['alphaReceptorActivity',alphaReceptorActivity],
    ['adhPoolLog10Conc',adhPoolLog10Conc],
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
  positive(o2MaxMlPerMl,'o2MaxMlPerMl');
  positive(hgbP50,'hgbP50');
  positive(hgbScaleForSat,'hgbScaleForSat');
  positive(errorLimitMmHg,'errorLimitMmHg');
  if(plasmaVolumeFraction<0||plasmaVolumeFraction>1){
    throw new Error('plasmaVolumeFraction must be between 0 and 1');
  }

  const args={
    side,
    pressureGradientMmHg,
    alphaReceptorActivity,
    adhPoolLog10Conc,
    o2NeedMlPerMin,
    viscosityConductanceEffect,
    anesthesiaVascularConductance,
    vasculatureEffect,
    infarctionEffect,
    arterialO2ContentMlPerMl,
    o2MaxMlPerMl,
    hgbP50,
    hgbScaleForSat,
  };

  let lo=0;
  let hi=arterialPo2MmHg;
  let loState=stateAtPo2(lo,args);
  let hiState=stateAtPo2(hi,args);
  let best=Math.abs(loState.residualMmHg)<=Math.abs(hiState.residualMmHg)
    ? loState : hiState;
  let iterations=0;

  for(;iterations<maxIterations;iterations++){
    const mid=(lo+hi)/2;
    const s=stateAtPo2(mid,args);
    if(Math.abs(s.residualMmHg)<Math.abs(best.residualMmHg)) best=s;
    if(Math.abs(s.residualMmHg)<=errorLimitMmHg){
      best=s;
      break;
    }

    const loSign=Math.sign(loState.residualMmHg);
    const midSign=Math.sign(s.residualMmHg);
    if(loSign===0){
      best=loState;
      break;
    }
    if(loSign!==midSign){
      hi=mid;
      hiState=s;
    } else {
      lo=mid;
      loState=s;
    }
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
  });
}

module.exports={
  HEART_FLOW_CONFIG,
  IMPLICIT_ERROR_LIMIT_MMHG,
  SYMPS_ON_CONDUCTANCE,
  PO2_ON_CONDUCTANCE,
  ADH_ON_CONDUCTANCE,
  PO2_ON_AEROBIC_FRACTION,
  METABOLISM_ON_CONDUCTANCE,
  hermite,
  stateAtPo2,
  solveMyocardialFlow,
};
