// test/deterministic.test.js — Milestone 1 acceptance: deterministic clock.
// Per spec/TEST_PLAN.md §A: state contains no NaN/Inf; deterministic outputs.

const { SimulationClock } = require('../src/clock.js');

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

test('clock advances by dt on step', () => {
  const c = new SimulationClock(0.001);
  assert(c.t === 0, 'starts at 0');
  c.step();
  assert(Math.abs(c.t - 0.001) < 1e-12, 'after one step');
  c.step();
  assert(Math.abs(c.t - 0.002) < 1e-12, 'after two steps');
});

test('clock reset returns to 0', () => {
  const c = new SimulationClock(0.005);
  c.step(); c.step();
  c.reset();
  assert(c.t === 0, 'reset clears t');
  assert(c.steps === 0, 'reset clears steps');
});

test('two clocks produce identical traces', () => {
  const a = new SimulationClock(0.002);
  const b = new SimulationClock(0.002);
  const aTrace = [];
  const bTrace = [];
  for (let i = 0; i < 100; i++) {
    aTrace.push(a.t);
    bTrace.push(b.t);
    a.step();
    b.step();
  }
  for (let i = 0; i < 100; i++) {
    assert(Math.abs(aTrace[i] - bTrace[i]) < 1e-12, `diverge at step ${i}`);
  }
});

test('clock rejects non-positive dt', () => {
  let threw = 0;
  try { new SimulationClock(0); } catch (_) { threw++; }
  try { new SimulationClock(-0.001); } catch (_) { threw++; }
  try { new SimulationClock(NaN); } catch (_) { threw++; }
  assert(threw === 3, `expected 3 throws, got ${threw}`);
});

test('runFor executes the requested number of steps', () => {
  const c = new SimulationClock(0.01);
  let count = 0;
  c.runFor(0.5, () => { count += 1; });
  assert(count === 50, `expected 50, got ${count}`);
  assert(Math.abs(c.t - 0.5) < 1e-9, 'final t equals seconds');
});

test('runFor rejects non-positive duration', () => {
  const c = new SimulationClock(0.01);
  let threw = 0;
  try { c.runFor(0, () => {}); } catch (_) { threw++; }
  try { c.runFor(-1, () => {}); } catch (_) { threw++; }
  assert(threw === 2, `expected 2 throws, got ${threw}`);
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
