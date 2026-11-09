'use strict';

const assert = require('node:assert/strict');
const {
  SOURCE,
  createCalibrationTarget,
  meanAbsolutePercentageError,
  scoreCandidate,
} = require('../src/hennigs_gco2_ph_calibration.js');

assert.equal(SOURCE.targetExperiment.hypercapnia.inspiredCo2Fraction, 0.07);
assert.equal(SOURCE.targetExperiment.hypercapnia.durationSec, 1500);
assert.equal(SOURCE.targetExperiment.hypoxia.inspiredO2Fraction, 0.08);
assert.equal(SOURCE.targetExperiment.hypoxia.durationSec, 600);

assert.throws(
  () => createCalibrationTarget({
    hypercapniaSeries: [],
    hypoxiaSeries: [],
  }),
  /provenance/
);

const hypercapnia = [
  { timeSec: 0, respiratoryRatePerMin: 12, tidalVolumeL: 0.5 },
  { timeSec: 60, respiratoryRatePerMin: 18, tidalVolumeL: 0.7 },
];
const hypoxia = [
  { timeSec: 0, respiratoryRatePerMin: 12, tidalVolumeL: 0.5 },
  { timeSec: 60, respiratoryRatePerMin: 16, tidalVolumeL: 0.6 },
];

const target = createCalibrationTarget({
  hypercapniaSeries: hypercapnia,
  hypoxiaSeries: hypoxia,
  provenance: {
    hypercapnia: { kind: 'synthetic-test-only' },
    hypoxia: { kind: 'synthetic-test-only' },
  },
});

assert.equal(
  meanAbsolutePercentageError([10, 20], [11, 18], 'test'),
  10
);

const perfect = scoreCandidate({
  target,
  hypercapniaPrediction: hypercapnia,
  hypoxiaPrediction: hypoxia,
  candidateGPco2Ph: 1,
  candidateProvenance: { kind: 'synthetic-test-only' },
});
assert.equal(perfect.overallMapePercent, 0);
assert.equal(perfect.meetsHennigsNominalTenPercentCriterion, true);
assert.equal(perfect.authority, 'calibrated-candidate-not-source-exact');

const poor = scoreCandidate({
  target,
  hypercapniaPrediction: hypercapnia.map(x => ({
    ...x,
    respiratoryRatePerMin: x.respiratoryRatePerMin * 1.3,
  })),
  hypoxiaPrediction: hypoxia.map(x => ({
    ...x,
    tidalVolumeL: x.tidalVolumeL * 1.3,
  })),
  candidateGPco2Ph: 2,
});
assert(poor.overallMapePercent > 10);
assert.equal(poor.meetsHennigsNominalTenPercentCriterion, false);

console.log('ok - GCO2,pH calibration harness requires provenance-locked RR/VT target data');
