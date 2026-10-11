'use strict';

const assert=require('node:assert/strict');
const {
  validateHeldOut,
}=require('../scripts/validate-shimayoshi-acidosis-grid-surrogate.js');

function run(co2){
  const scale=1-(co2-10)*0.006;
  return {
    status:'shimayoshi-source-stress-trajectory-validated',
    provenance:{
      protocolName:'acidosis',
      sourceChallengeCo2Percent:co2,
    },
    trajectory:[
      {time_s:300,protocol:'acidosis',peak_Fb_mN_per_mm2:6,stress_ratio:1,end_cycle_pHi:7.1},
      {time_s:400,protocol:'acidosis',peak_Fb_mN_per_mm2:6*scale,stress_ratio:scale,end_cycle_pHi:6.9},
      {time_s:500,protocol:'acidosis',peak_Fb_mN_per_mm2:6*(scale+0.01),stress_ratio:scale+0.01,end_cycle_pHi:6.8},
    ],
  };
}

const runs=[10,15,20,25,30].map(run);
const x=validateHeldOut(runs,20);
assert.deepEqual(x.trainingLevels,[10,15,25,30]);
assert(x.maxAbsoluteErrorFbMnPerMm2<1e-12);
assert(x.maxRelativeErrorFb<1e-12);
assert.equal(x.cycles,3);

assert.throws(
  ()=>validateHeldOut(runs,10),
  /must remain bracketed/
);
console.log('ok - acidosis surrogate validates only on genuinely withheld bracketed source challenge');
