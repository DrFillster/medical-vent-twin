'use strict';

const { Simulation, VcAcController } = require('../src/simulation.js');
const { PRESETS } = require('../src/presets.js');
const { makePatientParams } = require('../src/contracts.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('ok -', name);
    passed += 1;
  } catch (e) {
    console.error('FAIL -', name, ':', e.message);
    failed += 1;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

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
    dt: 0.001,
    trackGas: false,
    initialPEEP: 8,
    initialRecruitmentState: {
      normal: 1,
      recruitable: 0.35,
      consolidated: 0,
    },
  });
}

test('setPEEP changes ventilator setting without reconstructing patient state', () => {
  const sim = makeSimulation();
  const stateBefore = sim.state;
  const snapshot = JSON.stringify(sim.state);
  const traceLength = sim.trace.length;
  const tBefore = sim.state.t;

  const result = sim.setPEEP(12);

  assert(result === 12, 'returns new PEEP');
  assert(sim.controller.settings.peep === 12, 'controller receives new PEEP');
  assert(sim.state === stateBefore, 'state object identity is preserved');
  assert(JSON.stringify(sim.state) === snapshot, 'state values are unchanged at intervention instant');
  assert(sim.state.t === tBefore, 'simulation time does not reset or advance');
  assert(sim.trace.length === traceLength, 'trace is not cleared or padded');
});

test('setPEEP records an auditable intervention event', () => {
  const sim = makeSimulation();
  sim.setPEEP(10);
  assert(sim.interventions.length === 1, 'one event expected');
  const event = sim.interventions[0];
  assert(event.kind === 'SET_PEEP');
  assert(event.from === 8);
  assert(event.to === 10);
  assert(event.t === 0);
});

test('setting same PEEP is idempotent and does not create a fake intervention', () => {
  const sim = makeSimulation();
  sim.setPEEP(8);
  assert(sim.interventions.length === 0);
});

test('invalid PEEP changes fail explicitly', () => {
  const sim = makeSimulation();
  let throws = 0;
  try { sim.setPEEP(-1); } catch (_) { throws++; }
  try { sim.setPEEP(NaN); } catch (_) { throws++; }
  try { sim.setPEEP(Infinity); } catch (_) { throws++; }
  assert(throws === 3, `expected 3 throws, got ${throws}`);
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
