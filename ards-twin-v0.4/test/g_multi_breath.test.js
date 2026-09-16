// test/g_multi_breath.test.js — v0.4.3 acceptance tests (Section G).
//
// Multi-breath simulation stability for VC and PC controllers across
// injury severity.

const assert = require('node:assert/strict');
const { makePatientParams, makeBoundaryFlow } = require('../src/contracts.js');
const { PRESETS } = require('../src/presets.js');
const { VcAcController } = require('../src/ventilator/vc_ac.js');
const { PcAcController } = require('../src/ventilator/pc_ac.js');
const { Simulation } = require('../src/simulation.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok  -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}

function runBreaths(presetName, controllerFactory, breaths = 5) {
  const params = makePatientParams(PRESETS[presetName]());
  const controller = controllerFactory();
  const sim = new Simulation({ params, controller, dt: 0.001, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } , trackGas: false });
  const breathDuration = 60 / controller.settings.rr;
  sim.runFor(breathDuration * breaths);
  return sim;
}

function checkStability(sim) {
  // Zero NaN/Inf
  for (let i = 0; i < sim.trace.length; i++) {
    const s = sim.trace[i];
    for (const k of ['airwayPressure', 'centralFlow', 'totalVolume']) {
      const v = s.output[k];
      assert(Number.isFinite(v), `${k} not finite at step ${i}: ${v}`);
    }
    for (const V of s.output.compartmentVolumes) {
      assert(Number.isFinite(V), `compartment V not finite: ${V}`);
      assert(V >= 0, `negative compartment volume: ${V}`);
      assert(V < 10, `compartment volume implausibly large: ${V}`);
    }
  }
  // PEEP maintained (no drift)
  const finalPEEP = sim.trace[sim.trace.length - 1].output.airwayPressure;
  assert(Math.abs(finalPEEP - 5) < 1 || Math.abs(finalPEEP - 12) < 5,
    `PEEP drift: final=${finalPEEP}`);
}

test('G1: VC multi-breath on Baseline - stable', () => {
  const sim = runBreaths('Baseline', () =>
    new VcAcController({ fio2: 0.4, peep: 5, rr: 14, vt: 0.480,
                         inspiratoryFlow: 0.5, inspiratoryPause: 0.3 }), 5);
  checkStability(sim);
});

test('G2: VC multi-breath on Injury C - stable', () => {
  const sim = runBreaths('Injury C', () =>
    new VcAcController({ fio2: 0.4, peep: 12, rr: 20, vt: 0.420,
                         inspiratoryFlow: 0.5, inspiratoryPause: 0.3 }), 3);
  checkStability(sim);
});

test('G3: PC multi-breath on Baseline - stable', () => {
  const sim = runBreaths('Baseline', () =>
    new PcAcController({ fio2: 0.4, peep: 5, rr: 14,
                         pinsp: 18, inspiratoryTime: 1.0 }), 5);
  checkStability(sim);
});

test('G4: PC multi-breath on Injury C - stable', () => {
  const sim = runBreaths('Injury C', () =>
    new PcAcController({ fio2: 0.4, peep: 12, rr: 20,
                         pinsp: 30, inspiratoryTime: 1.0 }), 3);
  checkStability(sim);
});

test('G: zero solver failures across all multi-breath runs', () => {
  let totalFailures = 0;
  const configs = [
    ['Baseline', () => new VcAcController({ fio2: 0.4, peep: 5, rr: 14, vt: 0.480,
       inspiratoryFlow: 0.5, inspiratoryPause: 0.3 })],
    ['Injury A', () => new VcAcController({ fio2: 0.4, peep: 8, rr: 18, vt: 0.420,
       inspiratoryFlow: 0.5, inspiratoryPause: 0.3 })],
    ['Injury B', () => new VcAcController({ fio2: 0.4, peep: 10, rr: 22, vt: 0.350,
       inspiratoryFlow: 0.5, inspiratoryPause: 0.3 })],
    ['Injury C', () => new VcAcController({ fio2: 0.4, peep: 12, rr: 26, vt: 0.280,
       inspiratoryFlow: 0.5, inspiratoryPause: 0.3 })],
    ['Injury C', () => new PcAcController({ fio2: 0.4, peep: 12, rr: 26,
       pinsp: 35, inspiratoryTime: 1.0 })],
  ];
  for (const [preset, mk] of configs) {
    const params = makePatientParams(PRESETS[preset]());
    const ctrl = mk();
    const sim = new Simulation({ params, controller: ctrl, dt: 0.001, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } , trackGas: false });
    sim.runFor(60 / ctrl.settings.rr * 3);
    for (const t of sim.trace) {
      if (t.output.solverFailure) totalFailures++;
    }
  }
  assert(totalFailures === 0,
    `${totalFailures} solver failures across multi-breath runs`);
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
