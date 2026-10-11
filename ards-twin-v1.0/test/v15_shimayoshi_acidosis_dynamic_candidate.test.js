'use strict';

const assert=require('node:assert/strict');
const {
  TRAINING_VALIDATION,
  parametersForCo2,
  initialState,
  advanceDynamicCandidate,
}=require('../src/shimayoshi_acidosis_dynamic_candidate.js');

assert.equal(TRAINING_VALIDATION.blindDynamicResultUsedForFit,false);
assert.equal(TRAINING_VALIDATION.blindDynamicWorkflowRunId,38166194835);
assert.equal(TRAINING_VALIDATION.mildHeldOutValidation.heldOutCo2Percent,7.5);
assert.equal(TRAINING_VALIDATION.mildHeldOutValidation.fittedToHeldOutTrajectory,false);
assert(TRAINING_VALIDATION.mildHeldOutValidation.maxRelativeStressRatioError<0.0012);
assert.equal(initialState().stressRatio,1);

const p15=parametersForCo2(15);
assert(p15.A>0);
assert(p15.tauFastS>0);

let s=initialState();
for(let i=0;i<300;i++){
  s=advanceDynamicCandidate({
    state:s,
    sourceCo2Percent:30,
    dtSec:1,
  });
}
assert(s.stressRatio<1);

const depressed=s.stressRatio;
for(let i=0;i<60;i++){
  s=advanceDynamicCandidate({
    state:s,
    sourceCo2Percent:5,
    dtSec:1,
  });
}
assert(s.stressRatio>depressed);
assert.equal(s.closedLoopPressureAuthority,false);

const p6=parametersForCo2(6);
const p75=parametersForCo2(7.5);
const p9=parametersForCo2(9);
assert(p75.A>p6.A&&p75.A<p9.A);
assert(p75.B>p6.B&&p75.B<p9.B);

assert.throws(
  ()=>parametersForCo2(5.5),
  /baseline 5 or within validated challenge grid/
);
console.log('ok - pre-registered dynamic acidosis candidate is stateful, bounded, and non-authoritative');
