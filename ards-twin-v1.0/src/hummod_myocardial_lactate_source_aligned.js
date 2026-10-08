'use strict';

// Exact source-aligned HumMod myocardial lactate mass-balance primitive.
// Pinned source:
// riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
// Structure/LeftHeart/LeftHeart-Lactate.DES
// Structure/RightHeart/RightHeart-Lactate.DES

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

const MEQ_ML_TO_MG_DL=9008.0;
const GLUCOSE_TO_LACTATE=0.99;
const MG_TO_MEQ=0.0112;

const HEART_CONFIG=Object.freeze({
  left:Object.freeze({
    diffusionConductance:18.0,
    initialMass:0.17,
    errorLimit:0.002,
  }),
  right:Object.freeze({
    diffusionConductance:3.0,
    initialMass:0.030,
    errorLimit:0.00030,
  }),
});

function calculateMyocardialLactateDerivatives({
  side,
  mass,
  liquidVolumeMl,
  anaerobicGlucoseUsedMgPerMin,
  lactateUsedMgPerMin,
  lactatePoolConcentration,
  dxMin,
  dxUndefined=false,
}={}){
  if(side!=='left'&&side!=='right') throw new Error('side must be left or right');
  nonNegative(mass,'mass');
  positive(liquidVolumeMl,'liquidVolumeMl');
  nonNegative(anaerobicGlucoseUsedMgPerMin,'anaerobicGlucoseUsedMgPerMin');
  nonNegative(lactateUsedMgPerMin,'lactateUsedMgPerMin');
  finite(lactatePoolConcentration,'lactatePoolConcentration');
  if(!dxUndefined) positive(dxMin,'dxMin');

  const cfg=HEART_CONFIG[side];
  const concentration=mass/liquidVolumeMl;
  const concentrationMeqPerL=1000*concentration;
  const concentrationMgDl=MEQ_ML_TO_MG_DL*concentration;

  const madeMgPerMin=GLUCOSE_TO_LACTATE*anaerobicGlucoseUsedMgPerMin;
  const made=MG_TO_MEQ*madeMgPerMin;
  const usedMgPerMin=lactateUsedMgPerMin;
  const used=MG_TO_MEQ*usedMgPerMin;
  const k=cfg.diffusionConductance/liquidVolumeMl;

  let alpha;
  if(dxUndefined){
    alpha=0;
  } else if((k*dxMin)>=100){
    alpha=4e-44;
  } else {
    alpha=Math.exp(-k*dxMin);
  }

  const outflux0=
    cfg.diffusionConductance*(concentration-lactatePoolConcentration);
  const outflux=(alpha*outflux0)+((1-alpha)*(made+used));
  const change=made-used-outflux;

  return Object.freeze({
    side,
    mass,
    concentration,
    concentrationMeqPerL,
    concentrationMgDl,
    madeMgPerMin,
    made,
    usedMgPerMin,
    used,
    k,
    alpha,
    outflux0,
    outflux,
    change,
    source:Object.freeze({
      diffusionConductance:cfg.diffusionConductance,
      initialMass:cfg.initialMass,
      errorLimit:cfg.errorLimit,
    }),
  });
}

function eulerStepMyocardialLactate(args){
  const d=calculateMyocardialLactateDerivatives(args);
  if(args.dxUndefined) return Object.freeze({...d,nextMass:d.mass});
  const nextMass=d.mass+d.change*args.dxMin;
  return Object.freeze({...d,nextMass});
}

module.exports={
  MEQ_ML_TO_MG_DL,
  GLUCOSE_TO_LACTATE,
  MG_TO_MEQ,
  HEART_CONFIG,
  calculateMyocardialLactateDerivatives,
  eulerStepMyocardialLactate,
};
