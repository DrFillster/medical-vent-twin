'use strict';

const assert = require('node:assert/strict');
const { Simulation } = require('../src/simulation.js');
const { PRESETS } = require('../src/presets.js');
const {
  createHennigsPatientEffortCandidate,
} = require('../src/hennigs_patient_effort_candidate.js');
const {
  createHennigsMechanicalClosedEffortCandidate,
} = require('../src/hennigs_mechanical_closed_effort_candidate.js');
const {
  PressureSupportCandidateController,
} = require('../src/ventilator/pressure_support_candidate.js');

const effort = createHennigsPatientEffortCandidate({
  dtSec: 0.001,
  dRel: 0.5,
  gainProfile: 'hennigs-2026-validation-reference',
  respiratoryFailureFraction: 0.75,
});

const closed = createHennigsMechanicalClosedEffortCandidate({
  effort,
  initialEndExpiratoryVolumeL: 0.5416124745859138,
  functionalResidualCapacityL: 2.5,
  heringBreuerThresholdL: 1.0,
});

const controller = new PressureSupportCandidateController({
  fio2: 0.4,
  peep: 5,
  pressureSupport: 8,
  flowTriggerLMin: 1.5,
  cycleOffFraction: 0.25,
  minExpiratoryTimeSec: 0.15,
  maxInspiratoryTimeSec: 1.5,
  riseTimeSec: 0.1,
  backupRatePerMin: 2,
});

const sim = new Simulation({
  params: PRESETS.phenotype_baseline(),
  controller,
  dt: 0.001,
  initialRecruitmentState: {
    normal: 1,
    recruitable: 0,
    consolidated: 0,
  },
  patientEffortProvider: closed.provider,
});

sim.runFor(30);

const completed = sim.metrics().filter(b => b.VtInspired > 0.02);
assert(completed.length >= 5, 'expected repeated supported breaths');
const meanVt = completed.reduce((sum, b) => sum + b.VtInspired, 0) /
  completed.length;
const minRelativeVolume = Math.min(...sim.trace.map(r => r.output.totalVolume));
const maxRelativeVolume = Math.max(...sim.trace.map(r => r.output.totalVolume));
const maxPmus = Math.max(...sim.trace.map(r => r.patientMusclePressureCmH2O));
const minPmus = Math.min(...sim.trace.map(r => r.patientMusclePressureCmH2O));
const absoluteMinVolume = 2.5 + minRelativeVolume;

assert(controller.snapshot().lastTrigger === 'FLOW');
assert(controller.snapshot().lastCycleReason === 'FLOW_CYCLE');
assert(Number.isFinite(meanVt) && meanVt > 0.1 && meanVt < 1.5);
assert(absoluteMinVolume >= 2.5,
  'absolute lung volume must remain at or above FRC reference');
assert(Number.isFinite(maxPmus) && Number.isFinite(minPmus));
assert(maxPmus > 0);
assert(minPmus < 0);
assert(controller.snapshot().controlAuthority === false);
assert(closed.snapshot().controlAuthority === false);

console.log('ok - Hennigs validation-reference mechanical PS loop remains bounded');
console.log(JSON.stringify({
  breaths: controller.breath,
  meanVt,
  minRelativeVolume,
  maxRelativeVolume,
  absoluteMinVolume,
  maxPmus,
  minPmus,
  lastTrigger: controller.snapshot().lastTrigger,
  lastCycleReason: controller.snapshot().lastCycleReason,
}, null, 2));
