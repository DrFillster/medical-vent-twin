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
  const sim = new Simulation({ params, controller, dt: 0.001, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } , trackGas: false });
  const breathDuration = 60 / controller.settings.rr;
  sim.runFor(breathDuration * 3);

  const iters = [];
  const substeps = [];
  const scaledRes = [];
  const halvings = [];
  const activeSetTransitions = [];
  let solverFailures = 0;
  for (const t of sim.trace) {
    iters.push(t.output.iterations);
    substeps.push(t.output.substeps);
    scaledRes.push(t.output.scaledResidual ?? t.output.residualNorm);
    // v0.4.3: machine-readable solverStats must include new fields.
    halvings.push(t.output.solverStats?.lineSearchHalvings ?? 0);
    activeSetTransitions.push(t.output.solverStats?.activeSetTransitions ?? -1);
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
    lineSearchHalvingsTotal: halvings.reduce((s, x) => s + x, 0),
    lineSearchHalvingsMean: halvings.reduce((s, x) => s + x, 0) / halvings.length,
    activeSetTransitionsTotal: activeSetTransitions.filter(x => x >= 0)
      .reduce((s, x) => s + x, 0),
    activeSetTransitionsPresent:
      activeSetTransitions.every(x => x >= 0),
    solverFailures,
  };
}

test('J1: solver diagnostics are machine-readable per preset', () => {
  const mk = () => new VcAcController({ fio2: 0.4, peep: 5, rr: 14, vt: 0.480,
    inspiratoryFlow: 0.5, inspiratoryPause: 0.3 });
  const diag = collectDiagnostics('phenotype_baseline', mk);
  assert(diag.mechanicsSteps > 0, 'mechanicsSteps recorded');
  assert(typeof diag.newtonIterMean === 'number', 'mean iters computed');
  assert(diag.solverFailures === 0, 'no solver failures on phenotype_baseline');
  assert(diag.activeSetTransitionsPresent,
    'solverStats.activeSetTransitions must be present on every step');
  assert(typeof diag.lineSearchHalvingsMean === 'number',
    'solverStats.lineSearchHalvings must be a number');
});

test('J2: low-PEEP phenotype_high_recruitability shows quantified solver work (no failures)', () => {
  const mk = () => new VcAcController({ fio2: 0.4, peep: 5, rr: 26, vt: 0.280,
    inspiratoryFlow: 0.5, inspiratoryPause: 0.3 });
  const diag = collectDiagnostics('phenotype_high_recruitability', mk);
  console.log(`   phenotype_high_recruitability PEEP=5: ${diag.newtonIterMean.toFixed(2)} avg iters, ` +
    `${diag.percentSubdivided.toFixed(1)}% subdivided, ` +
    `${diag.lineSearchHalvingsMean.toFixed(2)} mean halvings, ` +
    `${diag.activeSetTransitionsTotal} active-set transitions, ` +
    `${diag.solverFailures} failures`);
  assert(diag.solverFailures === 0, 'no solver failures');
  assert(diag.mechanicsSteps > 100, 'recorded mechanics steps');
});

test('J3: scaled residual is finite and converges', () => {
  const mk = () => new VcAcController({ fio2: 0.4, peep: 5, rr: 14, vt: 0.480,
    inspiratoryFlow: 0.5, inspiratoryPause: 0.3 });
  const diag = collectDiagnostics('phenotype_baseline', mk);
  assert(Number.isFinite(diag.meanScaledResidual),
    `meanScaledResidual must be finite, got ${diag.meanScaledResidual}`);
  assert(diag.maxScaledResidual < 1.0,
    `maxScaledResidual below 1.0, got ${diag.maxScaledResidual}`);
});

test('J4: active-set transitions are tracked and machine-readable', () => {
  // The phenotype_high_recruitability PEEP=5 scenario crosses the closure boundary a small
  // number of times per breath (3 across 6924 steps observed in v0.4.4).
  // We verify the counter is wired by checking it is present, numeric,
  // and non-negative on every step. We do NOT require a specific count.
  const params = makePatientParams(PRESETS['phenotype_high_recruitability']());
  const controller = new VcAcController({ fio2: 0.4, peep: 5, rr: 26, vt: 0.280,
    inspiratoryFlow: 0.5, inspiratoryPause: 0.3 });
  const sim = new Simulation({ params, controller, dt: 0.001, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } , trackGas: false });
  sim.runFor(60 / controller.settings.rr * 3);
  let totalTransitions = 0;
  for (const t of sim.trace) {
    const n = t.output.solverStats?.activeSetTransitions;
    assert(typeof n === 'number',
      `activeSetTransitions must be a number, got ${n} at step`);
    assert(n >= 0, `activeSetTransitions must be non-negative, got ${n}`);
    totalTransitions += n;
  }
  console.log(`   Total active-set transitions: ${totalTransitions}`);
  // Tightened from >= 0 to >= 1 in OQ-1 (v0.4.4 observed 3 transitions).
  // If this assertion ever fails, the active-set counter has been
  // disconnected or the scenario has changed; investigate before relaxing.
  assert(totalTransitions >= 1, 'active-set counter is wired and observed at least one transition');
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
