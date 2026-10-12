'use strict';

const {
  inheritedNeuralSigmoid,
}=require('./hennigs_respiratory_center_primitives.js');

/**
 * Hennigs 2026 five-population respiratory neural oscillator.
 *
 * Scope:
 * - exact Table-2 source->target topology;
 * - Drel-dependent tonic inputs;
 * - Eqs. 9-10 respiratory-rate coupling;
 * - Eq. 1 derivatives.
 *
 * Not included:
 * - chemical calculation of Drel;
 * - stochastic terms;
 * - mechanoreflex modifications;
 * - Pmus;
 * - lung mechanics.
 *
 * Authority: candidate-not-canonical.
 */

const SOURCE=Object.freeze({
  citation:'Hennigs C et al. Patient-ventilator interaction—Development of a mathematical model of the respiratory center. Comput Methods Programs Biomed. 2026;280:109329.',
  doi:'10.1016/j.cmpb.2026.109329',
  equations:'1,8,9,10; Table 2',
  authority:'candidate-not-canonical',
});

const POPULATIONS=Object.freeze(['R','I','L','P','E']);

// Table 2. Rows are source populations; columns are target populations.
// Null represents the printed dash / absent connection.
const W=Object.freeze({
  R:Object.freeze({R:0.7,I:null,L:-2.1,P:-2.3,E:-2.3}),
  I:Object.freeze({R:-1.8,I:0.7,L:1.4,P:null,E:-0.7}),
  L:Object.freeze({R:null,I:-5.0,L:2.3,P:null,E:null}),
  P:Object.freeze({R:-2.2,I:-1.7,L:-3.0,P:1.5,E:0}),
  E:Object.freeze({R:null,I:-1.4,L:-0.8,P:-1.4,E:1.6}),
});

const BASAL_TONIC=Object.freeze({
  R:2.19,
  I:5.04,
  P:3.99,
  E:4.14,
});

const DECAY=Object.freeze({
  R:0.59,
  I:1.24,
  L:2.09,
  P:1.4,
  E:1.41,
});

const RR=Object.freeze({
  basePerMin:10,
  amplitudePerMin:2.1,
  sensitivity:1.8,
  offsetPerMin:0.1212,
  scalePerMin:6.545,
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}

function relativeDrive01(v){
  finite(v,'dRel');
  if(v<0||v>1) throw new Error('dRel must be between 0 and 1');
  return v;
}

// Table-2 footnote.
function lateInspiratoryTonic(dRel){
  dRel=relativeDrive01(dRel);
  return 3.628*dRel*dRel-5.628*dRel-0.5901;
}

// Eq. 9.
function respiratoryRatePerMin(dRel){
  dRel=relativeDrive01(dRel);
  return RR.basePerMin+
    Math.exp(RR.sensitivity*dRel)*RR.amplitudePerMin;
}

// Eq. 10, preserved exactly as printed.
function respiratoryRateCouplingScale(dRel){
  const rr=respiratoryRatePerMin(dRel);
  return (rr-RR.offsetPerMin)/RR.scalePerMin;
}

// Eq. 8 plus Table-2 L footnote.
function tonicInputs(dRel){
  dRel=relativeDrive01(dRel);
  return Object.freeze({
    R:dRel*BASAL_TONIC.R,
    I:dRel*BASAL_TONIC.I,
    L:lateInspiratoryTonic(dRel),
    P:dRel*BASAL_TONIC.P,
    E:dRel*BASAL_TONIC.E,
  });
}

function validateState(state){
  if(!state||typeof state!=='object'){
    throw new Error('state is required');
  }
  const out={};
  for(const p of POPULATIONS){
    out[p]=finite(state[p],'state.'+p);
  }
  return out;
}

/**
 * Eq. 1 derivative.
 * W[source][target] is multiplied by S(source activity). All W_ij are
 * scaled by K_RR per Hennigs. Tonic inputs are handled separately.
 *
 * tonicAdjustments allows later source-complete reflex terms to alter tonic
 * inputs without changing the base oscillator topology.
 */
function oscillatorDerivatives({
  state,
  dRel,
  tonicAdjustments=null,
  sigmoidK=0.6,
}={}){
  const x=validateState(state);
  dRel=relativeDrive01(dRel);
  finite(sigmoidK,'sigmoidK');

  const b={...tonicInputs(dRel)};
  if(tonicAdjustments!=null){
    for(const p of POPULATIONS){
      const v=tonicAdjustments[p]??0;
      finite(v,'tonicAdjustments.'+p);
      b[p]+=v;
    }
  }

  const kRR=respiratoryRateCouplingScale(dRel);
  const activity={};
  for(const p of POPULATIONS){
    activity[p]=inheritedNeuralSigmoid(x[p],{k:sigmoidK});
  }

  const dx={};
  for(const target of POPULATIONS){
    let coupling=0;
    for(const source of POPULATIONS){
      const wij=W[source][target];
      if(wij==null) continue;
      coupling+=kRR*wij*activity[source];
    }
    dx[target]=-DECAY[target]*x[target]+coupling+b[target];
  }

  return Object.freeze({
    derivatives:Object.freeze(dx),
    neuralOutput:Object.freeze(activity),
    tonic:Object.freeze(b),
    respiratoryRatePerMin:respiratoryRatePerMin(dRel),
    kRR,
    dRel,
    authority:SOURCE.authority,
  });
}

module.exports=Object.freeze({
  SOURCE,
  POPULATIONS,
  W,
  BASAL_TONIC,
  DECAY,
  RR,
  lateInspiratoryTonic,
  respiratoryRatePerMin,
  respiratoryRateCouplingScale,
  tonicInputs,
  oscillatorDerivatives,
});
