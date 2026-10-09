'use strict';

const {HUMMOD_SOURCE_IDENTITY}=require('./hummod_source_identity.js');
const {hermite}=require('./hummod_ards_autonomic_source_aligned.js');

const INTENSITY_CURVE=Object.freeze([
  Object.freeze({x:0,y:0,slope:0.007}),
  Object.freeze({x:300,y:1,slope:0}),
]);
const RATE_CURVE=Object.freeze([
  Object.freeze({x:0,y:0,slope:0.04}),
  Object.freeze({x:60,y:1,slope:0}),
]);
const METABOLIC_VASODILATION_STEADY_STATE_CURVE=Object.freeze([
  Object.freeze({x:50,y:1,slope:0}),
  Object.freeze({x:1000,y:3.5,slope:0.003}),
  Object.freeze({x:3000,y:5.5,slope:0}),
]);

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){finite(v,label);if(!(v>0))throw new Error(label+' must be > 0');return v;}
function nonNegative(v,label){finite(v,label);if(v<0)throw new Error(label+' must be >= 0');return v;}

function skeletalMusclePumpingEffect({
  motionWatts,
  contractionRatePerMin,
}={}){
  nonNegative(motionWatts,'motionWatts');
  nonNegative(contractionRatePerMin,'contractionRatePerMin');
  const intensityEffect=hermite(INTENSITY_CURVE,motionWatts);
  const rateEffect=hermite(RATE_CURVE,contractionRatePerMin);
  return Object.freeze({
    intensityEffect,
    rateEffect,
    effect:1+(intensityEffect*rateEffect),
    provenance:Object.freeze({
      status:'source-aligned',
      sourceRepository:HUMMOD_SOURCE_IDENTITY.canonicalRepository,
      sourceRevision:HUMMOD_SOURCE_IDENTITY.canonicalRevision,
      sourceStructure:'SkeletalMuscle-MusclePumping',
      clinicalValidation:false,
    }),
  });
}

function createSkeletalMuscleMetabolicVasodilation({
  initialEffect=1,
  onTauMin=0.2,
  offTauMin=1.0,
}={}){
  positive(initialEffect,'initialEffect');
  positive(onTauMin,'onTauMin');
  positive(offTauMin,'offTauMin');
  let effect=initialEffect;
  let last=null;

  function step({dtSec,o2NeedMlPerMin}={}){
    positive(dtSec,'dtSec');
    nonNegative(o2NeedMlPerMin,'o2NeedMlPerMin');
    const steadyState=hermite(
      METABOLIC_VASODILATION_STEADY_STATE_CURVE,
      o2NeedMlPerMin
    );
    const tauMin=effect<=steadyState?onTauMin:offTauMin;
    const tauSec=tauMin*60;
    effect=steadyState+(effect-steadyState)*Math.exp(-dtSec/tauSec);
    last=Object.freeze({
      o2NeedMlPerMin,
      steadyState,
      effect,
      tauMin,
    });
    return snapshot();
  }

  function snapshot(){
    return Object.freeze({
      schema:'hummod-source-aligned-skeletal-muscle-metabolic-vasodilation/v1',
      ...(last||{o2NeedMlPerMin:null,steadyState:null,effect,tauMin:null}),
      provenance:Object.freeze({
        status:'source-aligned-differential-equation-with-explicit-integration-adaptation',
        sourceRepository:HUMMOD_SOURCE_IDENTITY.canonicalRepository,
        sourceRevision:HUMMOD_SOURCE_IDENTITY.canonicalRevision,
        sourceStructure:'SkeletalMuscle-MetabolicVasodilation',
        sourceOnTauMin:onTauMin,
        sourceOffTauMin:offTauMin,
        integrationAdaptation:'exact exponential integration of source first-order delay; DES delay solver identity not claimed',
        clinicalValidation:false,
      }),
    });
  }

  return Object.freeze({step,snapshot});
}

module.exports={
  INTENSITY_CURVE,
  RATE_CURVE,
  METABOLIC_VASODILATION_STEADY_STATE_CURVE,
  skeletalMusclePumpingEffect,
  createSkeletalMuscleMetabolicVasodilation,
};
