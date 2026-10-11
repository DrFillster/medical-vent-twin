'use strict';

const assert=require('node:assert/strict');
const {
  SOURCE_CONTROL_PEAK_FB_MN_PER_MM2,
  VALIDATION,
  interpolateParams,
  shimayoshiAcidosisStepSurrogate,
}=require('../src/shimayoshi_acidosis_step_surrogate.js');

const onset=shimayoshiAcidosisStepSurrogate({
  challengeCo2Percent:30,
  phase:'challenge',
  elapsedSec:0,
});
assert(Math.abs(onset.stressRatio-1)<1e-12);
assert.equal(onset.closedLoopPressureAuthority,false);
assert.equal(onset.pressureShadowEligible,true);
console.log('ok - source-fit acidosis surrogate begins at source control force');

const mid=shimayoshiAcidosisStepSurrogate({
  challengeCo2Percent:20,
  phase:'challenge',
  elapsedSec:120,
});
assert(mid.stressRatio<1);
assert(mid.peakFbMnPerMm2<SOURCE_CONTROL_PEAK_FB_MN_PER_MM2);
console.log('ok - source-fit acidosis surrogate depresses active force during challenge');

const p=interpolateParams({
  10:{A:1,B:2,tauFastS:10,tauSlowS:100},
  15:{A:2,B:3,tauFastS:20,tauSlowS:200},
  20:{A:3,B:4,tauFastS:40,tauSlowS:400},
  25:{A:4,B:5,tauFastS:80,tauSlowS:800},
  30:{A:5,B:6,tauFastS:160,tauSlowS:1600},
},12.5);
assert.equal(p.A,1.5);
assert.equal(p.B,2.5);
assert(Math.abs(p.tauFastS-Math.sqrt(200))<1e-12);
console.log('ok - between-grid interpolation is explicit and bounded');

assert.throws(
  ()=>shimayoshiAcidosisStepSurrogate({
    challengeCo2Percent:35,
    phase:'challenge',
    elapsedSec:10,
  }),
  /outside validated Shimayoshi source grid/
);
assert.throws(
  ()=>shimayoshiAcidosisStepSurrogate({
    challengeCo2Percent:20,
    phase:'recovery',
    elapsedSec:61,
  }),
  /exceeds validated source phase duration/
);
console.log('ok - surrogate refuses source extrapolation');

assert(VALIDATION.challenge.level15MaxRelativeError<0.011);
assert(VALIDATION.challenge.level25MaxRelativeError<0.011);
assert(VALIDATION.recovery.level15MaxRelativeError<0.008);
assert(VALIDATION.recovery.level25MaxRelativeError<0.008);
console.log('ok - held-out source-level validation remains within recorded error bounds');
