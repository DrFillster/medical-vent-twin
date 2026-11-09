'use strict';

const { Simulation, PcAcController } = require('../src/simulation.js');
const { PRESETS } = require('../src/presets.js');
const {
  createHennigsPatientEffortCandidate,
} = require('../src/hennigs_patient_effort_candidate.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

let rejected = false;
try {
  createHennigsPatientEffortCandidate({ dtSec: 0.001, dRel: 0.5 });
} catch (e) {
  rejected = /kI/.test(e.message);
}
assert(rejected, 'candidate must fail closed without caller-supplied muscle gains');

const bridge = createHennigsPatientEffortCandidate({
  dtSec: 0.001,
  dRel: 0.5,
  kI: 2.0,
  kE: 2.0,
});

const params = PRESETS.phenotype_baseline();
const controller = new PcAcController({
  fio2: 0.4,
  peep: 5,
  rr: 14,
  pinsp: 8,
  inspiratoryTime: 1,
  inspiratoryPause: 0,
});
const sim = new Simulation({
  params,
  controller,
  dt: 0.001,
  initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
  patientEffortProvider: bridge.provider,
});

sim.runFor(12);
const pmus = sim.trace.map(r => r.patientMusclePressureCmH2O);
const maxPmus = Math.max(...pmus);
const minPmus = Math.min(...pmus);
assert(maxPmus > 0.5, 'Hennigs bridge should generate inspiratory muscle pressure');
assert(sim.trace.some(r => Math.abs(r.output.patientMusclePressureCmH2O) > 0.5),
  'Vent trace must preserve candidate muscle pressure');
assert(sim.trace.every(r => Number.isFinite(r.output.airwayPressure)),
  'airway pressure must remain finite under candidate effort');

const snap = bridge.snapshot();
assert(snap.controlAuthority === false);
assert(snap.authority === 'candidate-not-canonical');
assert(Number.isFinite(snap.prescribedRespiratoryRatePerMin));

console.log('ok - Hennigs candidate drives separate Vent Pmus path with explicit gains');
console.log(JSON.stringify({ maxPmus, minPmus, rr: snap.prescribedRespiratoryRatePerMin }, null, 2));
