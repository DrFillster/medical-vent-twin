// test/j_instrumentation.test.js — v0.4.3 acceptance tests (Section J).
//
// Machine-readable solver-work counters per scenario.

const assert = require('node:assert/strict');
const { makePatientParams } = require('../src/contracts.js');
const { PRESETS } = require('../src/presets.js');
const { VcAcController } = require('../src/ventilator/vc_ac.js');
const { Simulation } = require('../src/simulation.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok  -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}

function collectDiagnostics(presetName, controllerFactory) {
  const params = makePatientParams(PRESETS[presetName]());
  const controller = controllerFactory();
  const sim = new Simulation({ params, controller, dt: 0.001, trackGas: false });
  const breathDuration = 60 / controller.settings.rr;
  sim.runFor(breathDuration * 3);

  const iters = [];
  const substeps = [];
  const scaledRes = [];
  let solverFailures = 0;
  for (const t of sim.trace) {
    iters.push(t.output.iterations);
    substeps.push(t.output.substeps);
    scaledRes.push(t.output.scaledResidual ?? t.output.residualNorm);
    if (t.output.solverFailure) solverFailures++;
  }
  return {
    preset: presetName,
    mechanicsSteps: iters.length,
    newtonIterTotal: iters.reduce((s, x) => s + x, 0),
    newtonIterMean: iters.reduce((s, x) => s + x, 0) / iters.length,
    newtonIterMax: Math.max(...iters),
    substepTotal: substeps.reduce((s, x) => s + x, 0),
    maxSubsteps: Math.max(...substeps),
    percentSubdivided: substeps.filter(s => s > 1).length / substeps.length * 100,
    meanScaledResidual: scaledRes.reduce((s, x) => s + x, 0) / scaledRes.length,
    maxScaledResidual: Math.max(...scaledRes),
    solverFailures,
  };
}

test('J1: solver diagnostics are machine-readable per preset', () => {
  const mk = () => new VcAcController({ fio2: 0.4, peep: 5, rr: 14, vt: 0.480,
    inspiratoryFlow: 0.5, inspiratoryPause: 0.3 });
  const diag = collectDiagnostics('Baseline', mk);
  assert(diag.mechanicsSteps > 0, 'mechanicsSteps recorded');
  assert(typeof diag.newtonIterMean === 'number', 'mean iters computed');
  assert(diag.solverFailures === 0, 'no solver failures on Baseline');
});

test('J2: low-PEEP Injury C shows quantified solver work (no failures)', () => {
  const mk = () => new VcAcController({ fio2: 0.4, peep: 5, rr: 26, vt: 0.280,
    inspiratoryFlow: 0.5, inspiratoryPause: 0.3 });
  const diag = collectDiagnostics('Injury C', mk);
  console.log(`   Injury C PEEP=5: ${diag.newtonIterMean.toFixed(2)} avg iters, ` +
    `${diag.percentSubdivided.toFixed(1)}% subdivided, ` +
    `${diag.solverFailures} failures`);
  assert(diag.solverFailures === 0, 'no solver failures');
  assert(diag.mechanicsSteps > 100, 'recorded mechanics steps');
});

test('J3: scaled residual is finite and converges', () => {
  const mk = () => new VcAcController({ fio2: 0.4, peep: 5, rr: 14, vt: 0.480,
    inspiratoryFlow: 0.5, inspiratoryPause: 0.3 });
  const diag = collectDiagnostics('Baseline', mk);
  assert(Number.isFinite(diag.meanScaledResidual),
    `meanScaledResidual must be finite, got ${diag.meanScaledResidual}`);
  assert(diag.maxScaledResidual < 1.0,
    `maxScaledResidual below 1.0, got ${diag.maxScaledResidual}`);
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
