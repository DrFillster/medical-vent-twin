'use strict';

const assert=require('node:assert/strict');
const artifact=require('../artifacts/v1.5/SHIMAYOSHI_DYNAMIC_CO2_BLIND_VALIDATION_V2.json');
const {
  BLIND_VALIDATION,
  TRAINING_VALIDATION,
}=require('../src/shimayoshi_acidosis_dynamic_candidate.js');

assert.equal(artifact.schema,'shimayoshi-dynamic-co2-blind-validation/v2');
assert.equal(artifact.source.workflowRunId,38166194835);
assert.equal(artifact.source.artifactId,11712456381);
assert.equal(artifact.candidate.preRegisteredBeforeBlindOutput,true);
assert.equal(artifact.candidate.fittedToBlindTrajectory,false);
assert.equal(artifact.candidate.closedLoopAuthority,false);
assert.equal(
  artifact.globalMetrics.maxRelativeStressRatioError,
  BLIND_VALIDATION.maxRelativeStressRatioError
);
assert.equal(
  artifact.globalMetrics.rmseStressRatio,
  BLIND_VALIDATION.rmseStressRatio
);
assert.equal(
  TRAINING_VALIDATION.mildHeldOutValidation.heldOutCo2Percent,
  7.5
);
assert(
  TRAINING_VALIDATION.mildHeldOutValidation.maxRelativeStressRatioError<0.0012
);
console.log('ok - durable blind and mild held-out validation provenance is internally consistent');
