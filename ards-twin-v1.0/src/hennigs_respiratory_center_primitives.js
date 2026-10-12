'use strict';

/**
 * Source-complete primitives for the Hennigs 2026 respiratory-center candidate.
 *
 * IMPORTANT:
 * - This module does not implement the full neural oscillator.
 * - It does not own canonical respiratory drive or Pmus.
 * - Ambiguous/incomplete source equations fail closed and are not exposed.
 *
 * Primary:
 * Hennigs C et al. Comput Methods Programs Biomed. 2026;280:109329.
 * DOI: 10.1016/j.cmpb.2026.109329.
 *
 * Inherited oscillator nonlinearity:
 * Botros SM, Bruce EN. Biol Cybern. 1990;63:143-153.
 * DOI: 10.1007/BF00203037.
 * Exact algebra is supported here by later implementations explicitly
 * incorporating the Botros/Bruce oscillator; canonical authority remains blocked
 * pending direct primary-text verification.
 */

const SOURCE=Object.freeze({
  hennigs2026:Object.freeze({
    doi:'10.1016/j.cmpb.2026.109329',
    equations:'2,3,11,12,13,16,17',
  }),
  botrosBruce1990:Object.freeze({
    doi:'10.1007/BF00203037',
    role:'inherited sigmoid; reproduction evidence only',
  }),
  authority:'candidate-not-canonical',
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}

function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}

function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}

/**
 * Botros/Bruce-lineage neural output nonlinearity.
 *
 * S(X) = K*alpha(X) + (1-K)*beta(X)
 * alpha(X) = 0 for X<0, otherwise min(X,4)
 * beta(X) = 4/(1+exp[-1.75*(X-2)])
 *
 * K=0.6 is retained as inherited-model reproduction evidence, not a new fitted
 * project parameter.
 */
function inheritedNeuralSigmoid(x,{k=0.6}={}){
  finite(x,'x');
  finite(k,'k');
  if(k<0||k>1) throw new Error('k must be between 0 and 1');
  const alpha=x<0?0:Math.min(x,4);
  const beta=4/(1+Math.exp(-1.75*(x-2)));
  return k*alpha+(1-k)*beta;
}

/**
 * Exact held-target update for Hennigs-style first-order chemical drive:
 *   dD/dt = (target-D)/tau
 *
 * This helper intentionally takes the already sourced target as an input so it
 * cannot invent missing Eq.4/Eq.6 chemistry.
 */
function firstOrderDriveStep({
  drive,
  target,
  tauSec,
  dtSec,
}={}){
  finite(drive,'drive');
  finite(target,'target');
  positive(tauSec,'tauSec');
  nonNegative(dtSec,'dtSec');
  const derivative=(target-drive)/tauSec;
  if(dtSec===0){
    return Object.freeze({drive,derivative});
  }
  const decay=Math.exp(-dtSec/tauSec);
  const next=target+(drive-target)*decay;
  return Object.freeze({drive:next,derivative});
}

/**
 * Hennigs Eq.3 target only, expressed in source pressure units supplied by the
 * caller. The hypoxic term fails closed above the source threshold because the
 * paper describes activation below approximately 75 mmHg.
 *
 * No unit conversion is performed here.
 */
function peripheralHypoxiaTarget({
  pao2,
  threshold=75,
  gain,
}={}){
  nonNegative(pao2,'pao2');
  positive(threshold,'threshold');
  nonNegative(gain,'gain');
  const deficit=Math.max(0,threshold-pao2);
  return gain*deficit;
}

/**
 * Hennigs Eq.11 Hering-Breuer reflex transform.
 * Caller supplies lung volumes in the same units as kPrs.
 */
function heringBreuerDrive({
  lungVolume,
  endExpiratoryVolume,
  thresholdVolume,
  kPrs,
  sigmoidK=0.6,
}={}){
  finite(lungVolume,'lungVolume');
  finite(endExpiratoryVolume,'endExpiratoryVolume');
  nonNegative(thresholdVolume,'thresholdVolume');
  positive(kPrs,'kPrs');
  const x=kPrs*(
    lungVolume-endExpiratoryVolume-thresholdVolume
  );
  return inheritedNeuralSigmoid(x,{k:sigmoidK});
}

/**
 * Hennigs Eq.12 inspiratory-flow reflex.
 * Caller is responsible for source-consistent inspiratory-flow sign/units.
 */
function inspiratoryFlowDrive({
  inspiratoryFlow,
  kInsp,
  sigmoidK=0.6,
}={}){
  nonNegative(inspiratoryFlow,'inspiratoryFlow');
  positive(kInsp,'kInsp');
  return inheritedNeuralSigmoid(
    kInsp*inspiratoryFlow,
    {k:sigmoidK}
  );
}

/**
 * Hennigs Eq.13.
 * Pua = Rua*qaw - Pmus
 *
 * No sign conversion is performed. The caller must use the Hennigs convention.
 */
function upperAirwayPressure({
  upperAirwayResistance,
  airwayFlow,
  musclePressure,
}={}){
  nonNegative(upperAirwayResistance,'upperAirwayResistance');
  finite(airwayFlow,'airwayFlow');
  finite(musclePressure,'musclePressure');
  return upperAirwayResistance*airwayFlow-musclePressure;
}

/**
 * Hennigs Eq.16 piecewise respiratory-muscle pressure.
 *
 * Source convention: inspiratory Pmus is positive.
 */
function respiratoryMusclePressure({
  inspiratoryActivity,
  expiratoryActivity,
  expiratoryThreshold=5.2,
  kI,
  kE,
}={}){
  finite(inspiratoryActivity,'inspiratoryActivity');
  finite(expiratoryActivity,'expiratoryActivity');
  finite(expiratoryThreshold,'expiratoryThreshold');
  nonNegative(kI,'kI');
  nonNegative(kE,'kE');

  if(inspiratoryActivity>=0&&expiratoryActivity<expiratoryThreshold){
    return kI*inspiratoryActivity;
  }
  if(inspiratoryActivity<0&&expiratoryActivity>=expiratoryThreshold){
    return -kE*(expiratoryActivity-expiratoryThreshold);
  }
  return 0;
}

/**
 * Hennigs Eq.17 gain calculation.
 * Requires caller-supplied, independently verified Pmax and phiMax.
 */
function respiratoryMuscleGain({
  maxPressure,
  maxNeuralActivation,
  respiratoryFailureFraction=0,
}={}){
  nonNegative(maxPressure,'maxPressure');
  positive(maxNeuralActivation,'maxNeuralActivation');
  finite(respiratoryFailureFraction,'respiratoryFailureFraction');
  if(respiratoryFailureFraction<0||respiratoryFailureFraction>1){
    throw new Error(
      'respiratoryFailureFraction must be between 0 and 1'
    );
  }
  return (
    maxPressure*0.25/maxNeuralActivation
  )*(1-respiratoryFailureFraction);
}

module.exports=Object.freeze({
  SOURCE,
  inheritedNeuralSigmoid,
  firstOrderDriveStep,
  peripheralHypoxiaTarget,
  heringBreuerDrive,
  inspiratoryFlowDrive,
  upperAirwayPressure,
  respiratoryMusclePressure,
  respiratoryMuscleGain,
});
