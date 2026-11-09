'use strict';

const assert = require('node:assert/strict');
const { Simulation, PcAcController } = require('../src/simulation.js');
const { PRESETS } = require('../src/presets.js');
const {
  createHennigsPatientEffortCandidate,
} = require('../src/hennigs_patient_effort_candidate.js');
const {
  createHennigsMechanicalClosedEffortCandidate,
} = require('../src/hennigs_mechanical_closed_effort_candidate.js');

const params = PRESETS.phenotype_baseline();
const controller = new PcAcController({
  fio2: 0.4,
  peep: 5,
  rr: 14,
  pinsp: 8,
  inspiratoryTime: 1,
  inspiratoryPause: 0,
});

const effort = createHennigsPatientEffortCandidate({
  dtSec: 0.001,
  dRel: 0.5,
  gainProfile: 'hennigs-2026-validation-reference',
});

const initialEndExpiratoryVolumeL = 0.5416124745859138;
const closed = createHennigsMechanicalClosedEffortCandidate({
  effort,
  initialEndExpiratoryVolumeL,
  heringBreuerThresholdL: 1.0,
});

const sim = new Simulation({
  params,
  controller,
  dt: 0.001,
  initialRecruitmentState: {
    normal: 1,
    recruitable: 0,
    consolidated: 0,
  },
  patientEffortProvider: closed.provider,
});

sim.runFor(12);

const snap = closed.snapshot();
assert(snap.controlAuthority === false);
assert(Number.isFinite(snap.endExpiratoryVolumeL));
assert(Number.isFinite(snap.patientMusclePressureCmH2O));
assert(snap.mechanical.volumeReferenceOffsetL === 2.5);
assert(Math.abs(
  snap.mechanical.absoluteEndExpiratoryVolumeL -
  (2.5 + snap.endExpiratoryVolumeL)
) < 1e-12);
assert(snap.mechanical.absoluteLungVolumeL >= 2.5);
assert(snap.mechanical.controlAuthority === false);
assert(Number.isFinite(snap.mechanical.heringBreuerDrive));
assert(Number.isFinite(snap.mechanical.inspiratoryFlowDrive));

const tonic = effort.oscillator.snapshot().tonic;
const mechanicalTotal =
  snap.mechanical.heringBreuerDrive +
  snap.mechanical.inspiratoryFlowDrive;
const baseI = 5.04 * effort.snapshot().dRel;
const baseE = 4.14 * effort.snapshot().dRel;
assert(Math.abs(tonic.I - (baseI - mechanicalTotal)) < 1e-8);
assert(Math.abs(tonic.E - (baseE + mechanicalTotal)) < 1e-8);

const completedExpiratoryMinima = [];
for (let i = 1; i < sim.trace.length; i++) {
  if (sim.trace[i - 1].phase === 'EXPIRATION' &&
      sim.trace[i].phase === 'INSPIRATION') {
    let j = i - 1;
    let minimum = Infinity;
    while (j >= 0 && sim.trace[j].phase === 'EXPIRATION') {
      minimum = Math.min(minimum, sim.trace[j].output.totalVolume);
      j -= 1;
    }
    completedExpiratoryMinima.push(minimum);
  }
}
assert(completedExpiratoryMinima.length >= 2);
const measuredMin =
  completedExpiratoryMinima[completedExpiratoryMinima.length - 1];
assert(Math.abs(snap.endExpiratoryVolumeL - measuredMin) < 1e-6,
  'tracked V0 should equal the last completed end-expiratory minimum');

console.log('ok - Hennigs mechanical reflex loop tracks Vent V0 and feeds BI/BE');
console.log(JSON.stringify({
  endExpiratoryVolumeL: snap.endExpiratoryVolumeL,
  measuredCompletedExpiratoryMinimumL: measuredMin,
  heringBreuerDrive: snap.mechanical.heringBreuerDrive,
  inspiratoryFlowDrive: snap.mechanical.inspiratoryFlowDrive,
  pmus: snap.patientMusclePressureCmH2O,
}, null, 2));
