'use strict';

const {
  POPULATIONS,
  oscillatorDerivatives,
  respiratoryRatePerMin,
}=require('./hennigs_neural_oscillator_candidate.js');

const SOURCE=Object.freeze({
  citation:'Hennigs C et al. Comput Methods Programs Biomed. 2026;280:109329.',
  doi:'10.1016/j.cmpb.2026.109329',
  role:'isolated neural-oscillator source reproduction',
  authority:'candidate-not-canonical',
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}

function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}

function validateDRel(v){
  finite(v,'dRel');
  if(v<0||v>1) throw new Error('dRel must be between 0 and 1');
  return v;
}

function defaultNumericalSeed(){
  // Numerical starting state only. It is discarded after settling and is not
  // a physiologic initialization target.
  return Object.freeze({R:0.1,I:0.2,L:-0.1,P:0.1,E:0});
}

function cloneState(s){
  const out={};
  for(const p of POPULATIONS){
    out[p]=finite(s[p],'state.'+p);
  }
  return out;
}

function addScaled(a,b,scale){
  const out={};
  for(const p of POPULATIONS){
    out[p]=a[p]+scale*b[p];
  }
  return out;
}

function combineRk4(s,k1,k2,k3,k4,h){
  const out={};
  for(const p of POPULATIONS){
    out[p]=s[p]+h*(k1[p]+2*k2[p]+2*k3[p]+k4[p])/6;
  }
  return out;
}

function derivativeOnly(state,dRel,tonicAdjustments,sigmoidK){
  return oscillatorDerivatives({
    state,dRel,tonicAdjustments,sigmoidK,
  }).derivatives;
}

function createHennigsNeuralOscillatorRuntime({
  dtSec=0.001,
  dRel=0.5,
  initialState=null,
  tonicAdjustments=null,
  sigmoidK=0.6,
}={}){
  positive(dtSec,'dtSec');
  dRel=validateDRel(dRel);
  finite(sigmoidK,'sigmoidK');
  let state=cloneState(initialState||defaultNumericalSeed());
  let timeSec=0;

  function setRelativeDrive(next){
    dRel=validateDRel(next);
    return snapshot();
  }

  function step(){
    const h=dtSec;
    const k1=derivativeOnly(state,dRel,tonicAdjustments,sigmoidK);
    const k2=derivativeOnly(
      addScaled(state,k1,h/2),dRel,tonicAdjustments,sigmoidK
    );
    const k3=derivativeOnly(
      addScaled(state,k2,h/2),dRel,tonicAdjustments,sigmoidK
    );
    const k4=derivativeOnly(
      addScaled(state,k3,h),dRel,tonicAdjustments,sigmoidK
    );
    state=combineRk4(state,k1,k2,k3,k4,h);
    timeSec+=h;
    for(const p of POPULATIONS){
      if(!Number.isFinite(state[p])){
        throw new Error('non-finite oscillator state '+p);
      }
    }
    return snapshot();
  }

  function runFor(seconds){
    finite(seconds,'seconds');
    if(seconds<0) throw new Error('seconds must be >= 0');
    const n=Math.floor(seconds/dtSec+1e-9);
    for(let i=0;i<n;i++) step();
    const rem=seconds-n*dtSec;
    if(rem>1e-9){
      throw new Error('seconds must be an integer multiple of dtSec');
    }
    return snapshot();
  }

  function snapshot(){
    const derived=oscillatorDerivatives({
      state,dRel,tonicAdjustments,sigmoidK,
    });
    return Object.freeze({
      timeSec,
      state:Object.freeze({...state}),
      neuralOutput:derived.neuralOutput,
      dRel,
      prescribedRespiratoryRatePerMin:respiratoryRatePerMin(dRel),
      kRR:derived.kRR,
      authority:SOURCE.authority,
      controlAuthority:false,
      provenance:SOURCE,
    });
  }

  return Object.freeze({
    step,runFor,snapshot,setRelativeDrive,
    source:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  defaultNumericalSeed,
  createHennigsNeuralOscillatorRuntime,
});
