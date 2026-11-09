'use strict';

const { Simulation, PcAcController } = require('../src/simulation.js');
const { PRESETS } = require('../src/presets.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function makeSim(patientEffortProvider) {
  const params = PRESETS.phenotype_baseline();
  const controller = new PcAcController({
    fio2: 0.4,
    peep: 5,
    rr: 14,
    pinsp: 10,
    inspiratoryTime: 1.0,
    inspiratoryPause: 0,
  });
  return new Simulation({
    params,
    controller,
    dt: 0.001,
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
    patientEffortProvider,
  });
}

function meanCompletedVt(sim) {
  sim.runFor(5 * 60 / 14);
  const breaths = sim.metrics().slice(2, -1);
  return breaths.reduce((sum, b) => sum + b.VtInspired, 0) / breaths.length;
}

const passive = makeSim(null);
const assisted = makeSim(({ phase }) => phase === 'INSPIRATION' ? 5 : 0);

const passiveVt = meanCompletedVt(passive);
const assistedVt = meanCompletedVt(assisted);

assert(assistedVt > passiveVt,
  'positive inspiratory Pmus must increase delivered VT at identical ventilator pressure');

const insp = assisted.trace.find(row =>
  row.phase === 'INSPIRATION' && row.patientMusclePressureCmH2O === 5);
assert(insp, 'trace must record patient muscle pressure separately');
assert(Math.abs(insp.output.airwayPressure - 15) < 0.2,
  'patient effort must not be mislabeled as ventilator airway pressure');
assert(insp.output.patientMusclePressureCmH2O === 5,
  'mechanics output must expose Pmus separately');

let rejected = false;
try {
  makeSim(() => NaN).step();
} catch (e) {
  rejected = /finite Pmus/.test(e.message);
}
assert(rejected, 'non-finite effort must fail closed');

console.log('ok - patient effort raises VT without altering reported ventilator Paw');
console.log(JSON.stringify({ passiveVt, assistedVt }, null, 2));
