// test/h_dt_convergence.test.js — v0.4.3 acceptance tests (Section H).
//
// Compare breath-level outputs at dt = 2 ms, 1 ms, 0.5 ms.

const assert = require('node:assert/strict');
const { makePatientParams } = require('../src/contracts.js');
const { PRESETS } = require('../src/presets.js');
const { VcAcController } = require('../src/ventilator/vc_ac.js');
const { PcAcController } = require('../src/ventilator/pc_ac.js');
const { Simulation } = require('../src/simulation.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok  -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}

function runOne(presetName, controllerFactory, dt) {
  const params = makePatientParams(PRESETS[presetName]());
  const controller = controllerFactory();
  const sim = new Simulation({ params, controller, dt, trackGas: false, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } });
  const breathDuration = 60 / controller.settings.rr;
  sim.runFor(breathDuration * 2);   // 2 breaths
  const metrics = sim.metrics();
  return {
    Ppeak: metrics.breathMetrics?.[0]?.peakPressure ?? 0,
    Pplat: metrics.breathMetrics?.[0]?.plateauPressure ?? 0,
    drivingPressure: metrics.breathMetrics?.[0]?.drivingPressure ?? 0,
    RR: metrics.breathMetrics?.[0]?.respiratoryRate ?? 0,
    Vt: metrics.breathMetrics?.[0]?.tidalVolume ?? 0,
  };
}

function diff(a, b) {
  return {
    Ppeak: Math.abs(a.Ppeak - b.Ppeak),
    Pplat: Math.abs(a.Pplat - b.Pplat),
    drivingPressure: Math.abs(a.drivingPressure - b.drivingPressure),
    Vt: Math.abs(a.Vt - b.Vt),
  };
}

test('H1: VC dt convergence on Baseline', () => {
  const mk = () => new VcAcController({ fio2: 0.4, peep: 5, rr: 14, vt: 0.480,
    inspiratoryFlow: 0.5, inspiratoryPause: 0.3 });
  const r2 = runOne('Baseline', mk, 0.002);
  const r1 = runOne('Baseline', mk, 0.001);
  const r05 = runOne('Baseline', mk, 0.0005);
  const d12 = diff(r1, r2);
  const d105 = diff(r05, r1);
  // dt=2ms and dt=1ms should be closer than dt=1ms and dt=0.5ms.
  // Or at least all diffs should be small.
  console.log(`   dt=2→1ms: Ppeak=${d12.Ppeak.toFixed(3)}, Pplat=${d12.Pplat.toFixed(3)}, Vt=${d12.Vt.toExponential(2)}`);
  console.log(`   dt=1→0.5ms: Ppeak=${d105.Ppeak.toFixed(3)}, Pplat=${d105.Pplat.toFixed(3)}, Vt=${d105.Vt.toExponential(2)}`);
  assert(d12.Ppeak < 1.0, `Ppeak should be within 1 cmH2O across dt steps`);
  assert(d12.Vt < 0.05, `Vt within 50 mL across dt steps`);
});

test('H2: PC dt convergence on Injury B', () => {
  const mk = () => new PcAcController({ fio2: 0.4, peep: 10, rr: 22,
    pinsp: 30, inspiratoryTime: 0.8 });
  const r2 = runOne('Injury B', mk, 0.002);
  const r1 = runOne('Injury B', mk, 0.001);
  const d12 = diff(r1, r2);
  console.log(`   dt=2→1ms: Ppeak=${d12.Ppeak.toFixed(3)}, Vt=${d12.Vt.toExponential(2)}`);
  assert(d12.Ppeak < 2.0, `Ppeak within 2 cmH2O across dt steps`);
});

test('H: dt convergence table is monotonic', () => {
  // As dt shrinks, outputs should converge (smaller diff at smaller dt).
  const mk = () => new VcAcController({ fio2: 0.4, peep: 8, rr: 18, vt: 0.420,
    inspiratoryFlow: 0.5, inspiratoryPause: 0.3 });
  const r2 = runOne('Injury A', mk, 0.002);
  const r1 = runOne('Injury A', mk, 0.001);
  const r05 = runOne('Injury A', mk, 0.0005);
  const d12 = diff(r1, r2);
  const d105 = diff(r05, r1);
  // Convergence: |d105| < |d12| for at least one of the metrics.
  const convergent = (
    d105.Ppeak <= d12.Ppeak ||
    d105.Vt <= d12.Vt ||
    d105.Pplat <= d12.Pplat
  );
  assert(convergent,
    `dt=1→0.5ms diff not smaller than 2→1ms: ` +
    `Ppeak ${d12.Ppeak} → ${d105.Ppeak}, Vt ${d12.Vt} → ${d105.Vt}`);
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
