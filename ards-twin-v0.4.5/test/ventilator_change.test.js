'use strict';

const { Simulation, VcAcController, PcAcController } = require('../src/simulation.js');
const { PRESETS } = require('../src/presets.js');
const { makePatientParams } = require('../src/contracts.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function makeSimulation() {
  const params = makePatientParams(PRESETS.phenotype_moderate_recruitability());
  const controller = new VcAcController({
    fio2: 0.6,
    peep: 8,
    rr: 20,
    vt: 0.42,
    inspiratoryFlow: 0.7,
    inspiratoryPause: 0.2,
  });
  return new Simulation({
    params,
    controller,
    dt: 0.002,
    trackGas: false,
    initialPEEP: 8,
    initialRecruitmentState: {
      normal: 1,
      recruitable: 0.35,
      consolidated: 0,
    },
  });
}

test('controller change request preserves lung state until a breath boundary', () => {
  const sim = makeSimulation();
  sim.runFor(0.4);
  const before = {
    t: sim.state.t,
    volume: sim.state.totalVolume,
    recruitment: sim.state.compartments.map(c => c.recruitment),
    traceLength: sim.trace.length,
  };

  const next = new PcAcController({
    fio2: 0.5,
    peep: 10,
    rr: 18,
    pinsp: 12,
    inspiratoryTime: 0.8,
    inspiratoryPause: 0.1,
  });
  const request = sim.requestControllerChange(next, { source: 'test' });

  assert(request.kind === 'REQUEST_CONTROLLER_CHANGE');
  assert(sim.controller instanceof VcAcController);
  assert(sim.state.t === before.t);
  assert(sim.state.totalVolume === before.volume);
  assert(sim.trace.length === before.traceLength);
  assert(sim.state.compartments.every((c, i) => c.recruitment === before.recruitment[i]));
});

test('VC to PC change applies at completed-breath boundary without reconstructing patient', () => {
  const sim = makeSimulation();
  sim.runFor(0.4);
  const traceBeforeRequest = sim.trace.length;
  const next = new PcAcController({
    fio2: 0.5,
    peep: 10,
    rr: 18,
    pinsp: 12,
    inspiratoryTime: 0.8,
    inspiratoryPause: 0.1,
  });
  sim.requestControllerChange(next, { reason: 'mode-change-test' });
  sim.runFor(3.2);

  assert(sim.controller instanceof PcAcController, 'expected PC controller after boundary');
  assert(sim.controller.settings.peep === 10);
  assert(sim.controller.settings.rr === 18);
  assert(sim.trace.length > traceBeforeRequest, 'trace history must continue');
  assert(sim.state.t > 3, 'simulation time must continue');
  assert(sim.interventions.some(x => x.kind === 'APPLY_CONTROLLER_CHANGE'));
});

test('same-mode VC settings can change without resetting state', () => {
  const sim = makeSimulation();
  const next = new VcAcController({
    fio2: 0.7,
    peep: 9,
    rr: 16,
    vt: 0.38,
    inspiratoryFlow: 0.6,
    inspiratoryPause: 0.25,
  });
  sim.requestControllerChange(next, { reason: 'vc-settings-test' });
  sim.runFor(3.2);

  assert(sim.controller instanceof VcAcController);
  assert(sim.controller.settings.vt === 0.38);
  assert(sim.controller.settings.peep === 9);
  assert(sim.controller.settings.fio2 === 0.7);
});

test('controller changes are rejected while a bedside hold is pending', () => {
  const sim = makeSimulation();
  sim.requestInspiratoryHold(0.3);
  const next = new PcAcController({
    fio2: 0.5,
    peep: 10,
    rr: 18,
    pinsp: 12,
    inspiratoryTime: 0.8,
  });
  let threw = false;
  try { sim.requestControllerChange(next); } catch (_) { threw = true; }
  assert(threw);
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
