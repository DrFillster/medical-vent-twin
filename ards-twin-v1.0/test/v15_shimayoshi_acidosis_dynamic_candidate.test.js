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

assert.throws(
  ()=>parametersForCo2(7.5),
  /baseline 5 or within validated challenge grid/
);
console.log('ok - pre-registered dynamic acidosis candidate is stateful, bounded, and non-authoritative');
