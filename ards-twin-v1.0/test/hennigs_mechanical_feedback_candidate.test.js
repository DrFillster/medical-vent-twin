'use strict';

const assert = require('node:assert/strict');
const { Simulation, PcAcController } = require('../src/simulation.js');
const { PRESETS } = require('../src/presets.js');
const {
  createHennigsMechanicalFeedbackCandidate,
} = require('../src/hennigs_mechanical_feedback_candidate.js');

assert.throws(
  () => createHennigsMechanicalFeedbackCandidate({
    endExpiratoryVolumeL: 2.5,
  }),
  /heringBreuerThresholdL/
);

const f = createHennigsMechanicalFeedbackCandidate({
  endExpiratoryVolumeL: 2.5,
  heringBreuerThresholdL: 1.0,
});

const lowVolume = f.evaluate({
  totalLungVolumeL: 3.0,
  airwayFlowLps: 0,
});
const highVolume = f.evaluate({
  totalLungVolumeL: 4.2,
  airwayFlowLps: 0,
});
assert(highVolume.heringBreuerDrive > lowVolume.heringBreuerDrive);

const noFlow = f.evaluate({
  totalLungVolumeL: 3.0,
  airwayFlowLps: 0,
});
const inspFlow = f.evaluate({
  totalLungVolumeL: 3.0,
  airwayFlowLps: 0.6,
});
const expFlow = f.evaluate({
  totalLungVolumeL: 3.0,
  airwayFlowLps: -0.6,
});
assert(inspFlow.inspiratoryFlowDrive > noFlow.inspiratoryFlowDrive);
assert.equal(expFlow.inspiratoryFlowLps, 0);
assert.equal(expFlow.inspiratoryFlowDrive, noFlow.inspiratoryFlowDrive);
assert(inspFlow.controlAuthority === false);

const sim = new Simulation({
  params: PRESETS.phenotype_baseline(),
  controller: new PcAcController({
    fio2: 0.4,
    peep: 5,
    rr: 14,
    pinsp: 12,
    inspiratoryTime: 1,
    inspiratoryPause: 0,
  }),
  dt: 0.001,
  initialRecruitmentState: {
    normal: 1,
    recruitable: 0,
    consolidated: 0,
  },
});
sim.runFor(1);
const liveSignal = f.fromSimulation(sim);
assert(Number.isFinite(liveSignal.totalLungVolumeL));
assert(Number.isFinite(liveSignal.airwayFlowLps));

console.log('ok - Hennigs mechanical reflex signals come directly from Vent state');
console.log(JSON.stringify({
  lowHb: lowVolume.heringBreuerDrive,
  highHb: highVolume.heringBreuerDrive,
  noFlow: noFlow.inspiratoryFlowDrive,
  inspFlow: inspFlow.inspiratoryFlowDrive,
}, null, 2));
