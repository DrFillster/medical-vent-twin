'use strict';

// Source-aligned HumMod brain hypoxia subset for v1.3.
// Pinned source:
// riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
//
// Preserved equations:
// - Brain-Pressure pressure gradient
// - Brain-Flow tissue PO2 implicit relation
// - Brain-Flow O2-use/aerobic-fraction relation
// - BrainInsult-PO2 StableDelay derivative and PO2->Effect curve
// - Brain-Function Effect contribution from BrainInsult-PO2
//
// Deliberate reduced boundary:
// Brain-CO2.PCO2 is not yet dynamically ported in the browser runtime.
// The caller must provide a local-brain-PCO2 boundary. The v1.3 runtime
// currently uses venous PCO2 as an explicitly labeled temporary boundary.
// No arterial PO2 -> HR shortcut is used.

const {
  setupHgbProps,
  o2ContentToPo2,
}=require('./hummod_hgb_tissue_source_aligned.js');

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){ finite(v,label); if(!(v>0)) throw new Error(label+' must be > 0'); return v; }
function nonNegative(v,label){ finite(v,label); if(v<0) throw new Error(label+' must be >= 0'); return v; }

function hermite(points,x){
  finite(x,'curve input');
  if(x<=points[0].x) return points[0].y + points[0].slope*(x-points[0].x);
  const last=points[points.length-1];
  if(x>=last.x) return last.y + last.slope*(x-last.x);
  let i=0;
  while(i+1<points.length && x>points[i+1].x) i++;
  const a=points[i], b=points[i+1];
  const h=b.x-a.x, t=(x-a.x)/h;
  const h00=2*t*t*t-3*t*t+1;
  const h10=t*t*t-2*t*t+t;
  const h01=-2*t*t*t+3*t*t;
  const h11=t*t*t-t*t;
  return h00*a.y+h10*h*a.slope+h01*b.y+h11*h*b.slope;
}

const SOURCE=Object.freeze({
  brainFlowBasicConductance:9.1,
  brainFlowInitialPo2MmHg:37,
  brainFlowErrorLimitMmHg:0.37,
  brainPo2DelayInitialMmHg:37,
  brainPo2DelayKPerMin:4,
  brainPo2DelayErrorLimitMmHg:0.37,
  brainPo2DelayDxMaxMin:1,
  run06BaselineO2NeedMlPerMin:39.3065407483815,
});

const CURVES=Object.freeze({
  po2OnTension:Object.freeze([
    Object.freeze({x:22,y:0,slope:0}),
    Object.freeze({x:36,y:1,slope:0.02}),
    Object.freeze({x:60,y:1.2,slope:0}),
  ]),
  pco2OnTension:Object.freeze([
    Object.freeze({x:20,y:1.8,slope:0}),
    Object.freeze({x:45,y:1,slope:-0.05}),
    Object.freeze({x:75,y:0,slope:0}),
  ]),
  tensionOnConductance:Object.freeze([
    Object.freeze({x:0,y:2.2,slope:0}),
    Object.freeze({x:1,y:1,slope:-0.5}),
    Object.freeze({x:2,y:0.6,slope:0}),
  ]),
  po2OnAerobicFraction:Object.freeze([
    Object.freeze({x:2,y:0,slope:0}),
    Object.freeze({x:20,y:1,slope:0}),
  ]),
  brainInsultPo2Effect:Object.freeze([
    Object.freeze({x:10,y:0,slope:0}),
    Object.freeze({x:30,y:1,slope:0}),
  ]),
});

function flowStateAtPo2(po2,{
  pressureGradientMmHg,
  brainPco2MmHg,
  anesthesiaVascularConductance,
  viscosityConductanceEffect,
  brainVasculatureEffect,
  o2NeedMlPerMin,
  arterialO2ContentMlPerMl,
  o2MaxMlPerMl,
  hgbP50,
  hgbScaleForSat,
}){
  const po2OnTension=hermite(CURVES.po2OnTension,po2);
  const pco2OnTension=hermite(CURVES.pco2OnTension,brainPco2MmHg);
  const totalTension=
    po2OnTension*pco2OnTension*anesthesiaVascularConductance;
  const tensionEffect=hermite(CURVES.tensionOnConductance,totalTension);
  const conductance=
    SOURCE.brainFlowBasicConductance*
    tensionEffect*
    viscosityConductanceEffect*
    brainVasculatureEffect;
  const bloodFlowMlPerMin=Math.max(pressureGradientMmHg*conductance,0);
  const aerobicFraction=hermite(CURVES.po2OnAerobicFraction,po2);
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
    po2OnTension,
    pco2OnTension,
    totalTension,
    tensionEffect,
    conductance,
    bloodFlowMlPerMin,
    aerobicFraction,
    o2UseMlPerMin,
    tissueO2ContentMlPerMl,
    po2EndMmHg,
    residualMmHg:po2EndMmHg-po2,
  });
}

function solveBrainFlow({
  arterialPo2MmHg,
  arterialO2ContentMlPerMl,
  o2MaxMlPerMl,
  venousPh,
  venousPco2MmHg,
  carboxyPercent=0,
  tempC=37,
  pressureGradientMmHg,
  brainPco2MmHg,
  o2NeedMlPerMin=SOURCE.run06BaselineO2NeedMlPerMin,
  anesthesiaVascularConductance=1,
  viscosityConductanceEffect=1,
  brainVasculatureEffect=1,
  errorLimitMmHg=SOURCE.brainFlowErrorLimitMmHg,
  maxIterations=100,
}={}){
  nonNegative(arterialPo2MmHg,'arterialPo2MmHg');
  nonNegative(arterialO2ContentMlPerMl,'arterialO2ContentMlPerMl');
  positive(o2MaxMlPerMl,'o2MaxMlPerMl');
  finite(venousPh,'arterialPh');
  finite(venousPco2MmHg,'arterialPco2MmHg');
  nonNegative(carboxyPercent,'carboxyPercent');
  finite(tempC,'tempC');
  nonNegative(pressureGradientMmHg,'pressureGradientMmHg');
  finite(brainPco2MmHg,'brainPco2MmHg');
  positive(o2NeedMlPerMin,'o2NeedMlPerMin');
  positive(anesthesiaVascularConductance,'anesthesiaVascularConductance');
  positive(viscosityConductanceEffect,'viscosityConductanceEffect');
  nonNegative(brainVasculatureEffect,'brainVasculatureEffect');
  positive(errorLimitMmHg,'errorLimitMmHg');

  const hgb=setupHgbProps({
    tempC,
    pH:venousPh,
    pCO2MmHg:venousPco2MmHg,
    carboxyPercent,
  });
  const args={
    pressureGradientMmHg,
    brainPco2MmHg,
    anesthesiaVascularConductance,
    viscosityConductanceEffect,
    brainVasculatureEffect,
    o2NeedMlPerMin,
    arterialO2ContentMlPerMl,
    o2MaxMlPerMl,
    hgbP50:hgb.p50,
    hgbScaleForSat:hgb.scaleForSat,
  };

  let lo=0, hi=Math.max(arterialPo2MmHg,1e-9);
  let loState=flowStateAtPo2(lo,args);
  let hiState=flowStateAtPo2(hi,args);
  let best=Math.abs(loState.residualMmHg)<=Math.abs(hiState.residualMmHg)
    ? loState : hiState;
  let iterations=0;
  for(;iterations<maxIterations;iterations++){
    const mid=(lo+hi)/2;
    const s=flowStateAtPo2(mid,args);
    if(Math.abs(s.residualMmHg)<Math.abs(best.residualMmHg)) best=s;
    if(Math.abs(s.residualMmHg)<=errorLimitMmHg){ best=s; break; }
    if(Math.sign(loState.residualMmHg)!==Math.sign(s.residualMmHg)){
      hi=mid; hiState=s;
    }else{
      lo=mid; loState=s;
    }
  }
  return Object.freeze({
    ...best,
    hgb,
    solver:Object.freeze({
      method:'bounded-bisection',
      sourceErrorLimitMmHg:SOURCE.brainFlowErrorLimitMmHg,
      requestedErrorLimitMmHg:errorLimitMmHg,
      exactDesSolverIdentity:false,
      iterations,
      converged:Math.abs(best.residualMmHg)<=errorLimitMmHg,
    }),
  });
}

function createHumModSourceAlignedBrainHypoxia({
  initialPo2DelayMmHg=SOURCE.brainPo2DelayInitialMmHg,
}={}){
  finite(initialPo2DelayMmHg,'initialPo2DelayMmHg');
  let po2DelayMmHg=initialPo2DelayMmHg;
  let last=null;

  function step({dtSec,...flowInputs}={}){
    positive(dtSec,'dtSec');
    const flow=solveBrainFlow(flowInputs);
    const dtMin=dtSec/60;
    const alpha=1-Math.exp(-SOURCE.brainPo2DelayKPerMin*dtMin);
    const delayDerivativeMmHgPerMin=
      SOURCE.brainPo2DelayKPerMin*(flow.po2MmHg-po2DelayMmHg);
    po2DelayMmHg += alpha*(flow.po2MmHg-po2DelayMmHg);
    const po2Effect=hermite(CURVES.brainInsultPo2Effect,po2DelayMmHg);
    last=Object.freeze({
      flow,
      po2DelayMmHg,
      po2DelayInputMmHg:flow.po2MmHg,
      po2DelayDerivativeMmHgPerMin:delayDerivativeMmHgPerMin,
      po2Effect,
      brainFunctionEffect:po2Effect,
      brainFunctionFailed:po2Effect<0.2,
      provenance:Object.freeze({
        status:'source-aligned-brain-hypoxia-subset',
        brainFunctionAuthority:'BrainInsult-PO2 only; other BrainInsult terms held neutral',
        brainPco2Boundary:'caller supplied; browser currently uses venous PCO2 temporary boundary',
        empiricalArterialPo2ToHrShortcut:false,
        exactDesSolverIdentity:false,
      }),
    });
    return snapshot();
  }

  function snapshot(){
    return Object.freeze(last||{
      po2DelayMmHg,
      po2Effect:hermite(CURVES.brainInsultPo2Effect,po2DelayMmHg),
      brainFunctionEffect:hermite(CURVES.brainInsultPo2Effect,po2DelayMmHg),
      brainFunctionFailed:false,
      provenance:Object.freeze({
        status:'source-aligned-brain-hypoxia-subset',
        brainFunctionAuthority:'BrainInsult-PO2 only; other BrainInsult terms held neutral',
        brainPco2Boundary:'caller supplied; browser currently uses venous PCO2 temporary boundary',
        empiricalArterialPo2ToHrShortcut:false,
        exactDesSolverIdentity:false,
      }),
    });
  }

  return Object.freeze({kind:'hummod-source-aligned-brain-hypoxia',step,snapshot});
}

module.exports={
  SOURCE,
  CURVES,
  hermite,
  flowStateAtPo2,
  solveBrainFlow,
  createHumModSourceAlignedBrainHypoxia,
};
