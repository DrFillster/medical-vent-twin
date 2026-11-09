'use strict';

const { Simulation } = require('../src/simulation.js');
const { PRESETS } = require('../src/presets.js');
const {
  createHennigsPatientEffortCandidate,
} = require('../src/hennigs_patient_effort_candidate.js');
const {
  PressureSupportCandidateController,
} = require('../src/ventilator/pressure_support_candidate.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const bridge = createHennigsPatientEffortCandidate({
  dtSec: 0.001,
  dRel: 0.5,
  kI: 2.0,
  kE: 2.0,
});

const controller = new PressureSupportCandidateController({
  fio2: 0.4,
  peep: 5,
  pressureSupport: 8,
  triggerPmusCmH2O: 0.5,
  cycleOffFraction: 0.25,
  minInspiratoryTimeSec: 0.2,
  maxInspiratoryTimeSec: 1.5,
});

const sim = new Simulation({
  params: PRESETS.phenotype_baseline(),
  controller,
  dt: 0.001,
  initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
  patientEffortProvider: bridge.provider,
});

sim.runFor(20);

const snap = controller.snapshot();
const efforts = sim.trace.map(r => r.patientMusclePressureCmH2O);
const supported = sim.trace.filter(r =>
  r.phase === 'INSPIRATION' && r.output.airwayPressure > 12);

assert(Math.max(...efforts) > 0.5, 'Hennigs must generate trigger-capable Pmus');
assert(snap.breathIndex >= 3, 'Hennigs effort must trigger repeated PS breaths');
assert(supported.length > 100, 'PS breaths must produce sustained supported inspiration');
assert(sim.metrics().some(b => b.VtInspired > 0.1),
  'Hennigs-triggered supported breaths must deliver finite VT');
assert(snap.controlAuthority === false);
assert(bridge.snapshot().controlAuthority === false);

console.log('ok - Hennigs candidate triggers PS/CPAP through the Vent effort interface');
console.log(JSON.stringify({
  breaths: snap.breathIndex,
  maxPmus: Math.max(...efforts),
  lastCycleReason: snap.lastCycleReason,
}, null, 2));
