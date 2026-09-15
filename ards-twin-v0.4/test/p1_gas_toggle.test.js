// test/p1_gas_toggle.test.js — P1-1: gas state only evolves when trackGas=true.

const { Simulation, VcAcController } = require('../src/simulation.js');
const { PRESETS } = require('../src/presets.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function newSim(trackGas) {
  const params = PRESETS.Baseline();
  const v = new VcAcController({
    fio2: 0.4, peep: 5, rr: 14, vt: 0.480,
    inspiratoryFlow: 0.5, inspiratoryPause: 0.5,
  });
  return new Simulation({
    params, controller: v, dt: 0.001, fio2: 0.4, trackGas,
  });
}

// ---- T1: trackGas=true → gas state evolves during the simulation --------
test('trackGas=true: gas.compartments state changes after run', () => {
  const sim = newSim(true);
  const before = sim.gas.compartments.map(c => c.po2);
  sim.runFor(3 * 60 / 14);
  const after = sim.gas.compartments.map(c => c.po2);
  let changed = false;
  for (let i = 0; i < before.length; i++) {
    if (Math.abs(before[i] - after[i]) > 1e-6) { changed = true; break; }
  }
  assert(changed, `gas state did not change: before=${before}, after=${after}`);
});

// ---- T2: trackGas=false → gas state remains null/unchanged --------------
test('trackGas=false: gas state remains null', () => {
  const sim = newSim(false);
  assert(sim.gas === null, `gas state should be null when trackGas=false, got ${sim.gas}`);
  sim.runFor(3 * 60 / 14);
  assert(sim.gas === null, `gas state should remain null after run when trackGas=false`);
});

// ---- T3: gas summary accessible via gasSummary() when enabled ----------
test('trackGas=true: gasSummary() returns aggregated gas metrics', () => {
  const sim = newSim(true);
  sim.runFor(2 * 60 / 14);
  const s = sim.gasSummary();
  assert(s !== null, 'gasSummary should return non-null when trackGas=true');
  assert(typeof s.pao2 === 'number', 'gasSummary should include pao2');
  assert(typeof s.shunt === 'number', 'gasSummary should include shunt');
  assert(typeof s.deadSpace === 'number', 'gasSummary should include deadSpace');
});

// ---- T4: trackGas=false → gasSummary returns null -----------------------
test('trackGas=false: gasSummary returns null', () => {
  const sim = newSim(false);
  sim.runFor(2 * 60 / 14);
  assert(sim.gasSummary() === null,
    'gasSummary should return null when trackGas=false');
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
