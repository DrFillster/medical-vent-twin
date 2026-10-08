'use strict';

// Source-aligned HumMod StableDelay relation used by myocardial fuel adequacy.
// The pinned myocardial source declares:
//   initial = 1.0
//   input = FractUse
//   rate constant K = 0.5
//   derivative = Change
//   error limit = 0.01
//   DxMax = 1.0
//
// Native run06 confirms, to floating-point precision:
//   Change = K * (Input - Output)
//
// The exact DES 2005 time-integration algorithm is unavailable. The helper
// integrator below uses the exact continuous first-order solution for a
// piecewise-constant input and is therefore explicitly not claimed to be
// DES-solver-identical.

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}

const MYOCARDIAL_FUEL_DELAY=Object.freeze({
  initialValue:1.0,
  rateConstantPerMin:0.5,
  errorLimit:0.01,
  dxMaxMin:1.0,
});

function stableDelayDerivative({
  input,
  output,
  rateConstantPerMin=MYOCARDIAL_FUEL_DELAY.rateConstantPerMin,
}={}){
  finite(input,'input');
  finite(output,'output');
  positive(rateConstantPerMin,'rateConstantPerMin');
  return rateConstantPerMin*(input-output);
}

function stepStableDelayPiecewiseConstant({
  input,
  output,
  dtMin,
  rateConstantPerMin=MYOCARDIAL_FUEL_DELAY.rateConstantPerMin,
}={}){
  finite(input,'input');
  finite(output,'output');
  positive(dtMin,'dtMin');
  positive(rateConstantPerMin,'rateConstantPerMin');
  const derivative=stableDelayDerivative({input,output,rateConstantPerMin});
  const nextOutput=input+(output-input)*Math.exp(-rateConstantPerMin*dtMin);
  return Object.freeze({
    input,
    output,
    derivative,
    nextOutput,
    dtMin,
    rateConstantPerMin,
    solver:Object.freeze({
      method:'exact-first-order-piecewise-constant-input',
      exactDesSolverIdentity:false,
      sourceDerivativeIdentity:true,
    }),
  });
}

module.exports={
  MYOCARDIAL_FUEL_DELAY,
  stableDelayDerivative,
  stepStableDelayPiecewiseConstant,
};
