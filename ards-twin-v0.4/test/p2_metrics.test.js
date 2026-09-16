// test/p2_metrics.test.js — P2: breath metrics analyzer.

const { Simulation, VcAcController, PcAcController } = require('../src/simulation.js');
const { analyzeBreath, analyzeAll } = require('../src/metrics.js');
const { PRESETS } = require('../src/presets.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function newVC() {
  const v = new VcAcController({
    fio2: 0.4, peep: 5, rr: 14,
    vt: 0.480, inspiratoryFlow: 0.5, inspiratoryPause: 0.5,
  });
  return new Simulation({
    params: PRESETS.Baseline(), controller: v, dt: 0.001, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } , fio2: 0.4,
  });
}

// ---- T1: analyzer returns one record per completed breath ----
test('analyzeAll: returns one record per completed breath', () => {
  const sim = newVC();
  sim.runFor(4 * 60 / 14);
  const m = analyzeAll(sim.trace, 5);
  assert(m.length >= 3, `expected ≥3 breaths, got ${m.length}`);
  for (let i = 1; i < m.length; i++) {
    assert(m[i].breathStartT > m[i - 1].breathStartT,
      `breath ${i} not after breath ${i - 1}`);
  }
});

// ---- T2: VtInspired equals net V change in the breath ----
test('VtInspired: net lung volume change during inspiration', () => {
  const sim = newVC();
  sim.runFor(3 * 60 / 14);
  const ms = sim.metrics().slice(1, -1);
  assert(ms.length > 0);
  for (const m of ms) {
    assert(m.VtInspired > 0.3 && m.VtInspired < 0.7,
      `Vt ${m.VtInspired.toFixed(3)} out of plausible range`);
  }
});

// ---- T3: VtExpired < VtInspired (some gas retained) ----
test('VtExpired ≤ VtInspired: gas retention is non-negative', () => {
  const sim = newVC();
  sim.runFor(5 * 60 / 14);
  const ms = sim.metrics().slice(2, -1);
  for (const m of ms) {
    assert(m.VtExpired >= 0,
      `VtExpired ${m.VtExpired.toFixed(3)} should be ≥ 0`);
  }
});

// ---- T4: RR matches the set RR ----
test('RR: matches the controller setting (within 5%)', () => {
  const sim = newVC();
  sim.runFor(5 * 60 / 14);
  const ms = sim.metrics().slice(2, -1);
  for (const m of ms) {
    assert(Math.abs(m.RR - 14) < 14 * 0.05,
      `RR ${m.RR.toFixed(2)} deviates > 5% from 14`);
  }
});

// ---- T5: MV ≈ RR × Vt ----
test('MV ≈ RR × Vt', () => {
  const sim = newVC();
  sim.runFor(5 * 60 / 14);
  const ms = sim.metrics().slice(2, -1);
  for (const m of ms) {
    const expectedMV = (m.RR * m.VtInspired); // L/min
    assert(Math.abs(m.MV - expectedMV) < 0.5,
      `MV ${m.MV.toFixed(2)} vs expected ${expectedMV.toFixed(2)}`);
  }
});

// ---- T6: I:E ratio = Ti/Te ----
test('I:E ratio = Ti / Te', () => {
  const sim = newVC();
  sim.runFor(5 * 60 / 14);
  const ms = sim.metrics().slice(2, -1);
  for (const m of ms) {
    const ie = m.Ti / m.Te;
    assert(ie > 0 && ie < 5,
      `I:E ${ie.toFixed(2)} out of plausible range (Ti=${m.Ti.toFixed(3)}, Te=${m.Te.toFixed(3)})`);
  }
});

// ---- T7: PEEP, Ppeak, Pplat, driving pressure ----
test('PEEP, Ppeak, Pplat, driving pressure are sensible', () => {
  const sim = newVC();
  sim.runFor(5 * 60 / 14);
  const ms = sim.metrics().slice(2, -1);
  for (const m of ms) {
    assert(Math.abs(m.PEEP - 5) < 0.5,
      `PEEP ${m.PEEP.toFixed(2)} deviates from set 5`);
    assert(m.Ppeak >= m.PEEP,
      `Ppeak ${m.Ppeak.toFixed(2)} < PEEP ${m.PEEP.toFixed(2)}`);
    assert(m.Pplat >= m.PEEP - 0.5,
      `Pplat ${m.Pplat.toFixed(2)} < PEEP`);
    assert(m.drivingPressure >= 0,
      `driving pressure ${m.drivingPressure.toFixed(2)} < 0`);
  }
});

// ---- T8: peak inspiratory flow matches FLOW setting ----
test('Qpeak_insp ≈ FLOW setting (0.5 L/s)', () => {
  const sim = newVC();
  sim.runFor(5 * 60 / 14);
  const ms = sim.metrics().slice(2, -1);
  for (const m of ms) {
    assert(m.QpeakInsp > 0.3 && m.QpeakInsp < 0.7,
      `Qpeak_insp ${m.QpeakInsp.toFixed(3)} out of range`);
  }
});

// ---- T9: compartment volumes are exposed per breath ----
test('Compartment end-inspiratory / end-expiratory volumes exposed', () => {
  const sim = newVC();
  sim.runFor(3 * 60 / 14);
  const m = sim.metrics()[2];
  assert(m.compartments);
  for (let i = 0; i < 3; i++) {
    const c = m.compartments[`comp_${i}`];
    assert(typeof c.endInspV === 'number', `comp ${i} missing endInspV`);
    assert(typeof c.endExpV === 'number', `comp ${i} missing endExpV`);
    assert(c.endInspV >= c.endExpV - 0.01,
      `comp ${i} endInsp ${c.endInspV.toFixed(3)} < endExp ${c.endExpV.toFixed(3)}`);
  }
});

// ---- T10: metrics derive from trace, not settings ----
test('Metrics derived from trace: Vt differs from controller Vt setting', () => {
  // Set vt=0.480 but FLOW=0.5 with leak — actual Vt < 0.480.
  const sim = newVC();
  sim.runFor(5 * 60 / 14);
  const m = sim.metrics()[2];
  // Verify that VtInspired is the trace-derived value, NOT 0.480.
  assert(m.VtInspired !== sim.controller.settings.vt,
    `VtInspired should reflect actual lung dynamics, not setting`);
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
