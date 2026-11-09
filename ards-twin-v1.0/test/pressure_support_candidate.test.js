'use strict';

const { Simulation } = require('../src/simulation.js');
const { PRESETS } = require('../src/presets.js');
const {
  PressureSupportCandidateController,
} = require('../src/ventilator/pressure_support_candidate.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function effort({ timeSec }) {
  const phase = timeSec % 4;
  return phase < 1 ? 4 : 0;
}

function run(pressureSupport) {
  const controller = new PressureSupportCandidateController({
    fio2: 0.4,
    peep: 5,
    pressureSupport,
    triggerPmusCmH2O: 1,
    cycleOffFraction: 0.25,
    minInspiratoryTimeSec: 0.2,
    maxInspiratoryTimeSec: 1.5,
  });
  const sim = new Simulation({
    params: PRESETS.phenotype_baseline(),
    controller,
    dt: 0.001,
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
    patientEffortProvider: effort,
  });
  sim.runFor(16);
  return { sim, controller };
}

let rejected = false;
try {
  new PressureSupportCandidateController({
    fio2: 0.4,
    peep: 5,
    pressureSupport: 8,
  });
} catch (e) {
  rejected = /triggerPmusCmH2O/.test(e.message);
}
assert(rejected, 'candidate must fail closed when trigger/cycle settings are omitted');

const cpap = run(0);
const ps = run(8);

assert(ps.controller.breath >= 3, 'patient effort should trigger repeated supported breaths');
assert(ps.sim.trace.some(r => r.phase === 'INSPIRATION' && r.output.airwayPressure > 12),
  'pressure support should raise inspiratory airway pressure above CPAP');
assert(ps.sim.trace.some(r => r.phase === 'EXPIRATION' && Math.abs(r.output.airwayPressure - 5) < 0.2),
  'expiration should return to PEEP');

function meanBreathVt(sim) {
  const breaths = sim.metrics().filter(b => b.VtInspired > 0.02);
  return breaths.reduce((sum, b) => sum + b.VtInspired, 0) / breaths.length;
}

const cpapVt = meanBreathVt(cpap.sim);
const psVt = meanBreathVt(ps.sim);
assert(psVt > cpapVt,
  'pressure support must increase delivered VT for the same patient effort');

const snap = ps.controller.snapshot();
assert(snap.controlAuthority === false);
assert(snap.authority === 'candidate-not-canonical');

console.log('ok - candidate PS/CPAP triggers from Pmus and cycles without mandatory breaths');
console.log(JSON.stringify({
  cpapVt,
  psVt,
  triggeredBreaths: ps.controller.breath,
  lastCycleReason: snap.lastCycleReason,
}, null, 2));
