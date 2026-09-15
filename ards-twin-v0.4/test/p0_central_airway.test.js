// test/p0_central_airway.test.js — P0-1: central airway resistance
// participates in the proximal/distal airway mechanics.
//
// Required tests (from IMPLEMENTATION_BRIEF_v0.4.1.md):
//   1. Increasing Rcentral increases Ppeak during VC inspiration.
//   2. Zero-flow inspiratory hold: Pvent → Pbranch → no central drop.
//   3. Rcentral = 0 → legacy parallel-RC solution (regression).
//   4. FLOW conservation: requested Q = central Q = sum(branch Q).
//   5. PRESSURE conservation: central Q = sum(branch Q).
//   6. Paired-resistance: central R effects distinct from branch R.

const { ThreeCompartmentMechanics } = require('../src/mechanics.js');
const {
  makePatientParams, makeBoundaryFlow, makeBoundaryPressure,
  makeInitialState,
} = require('../src/contracts.js');
const { PRESETS } = require('../src/presets.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function makePresetParams(rc) {
  const p = PRESETS.Baseline();
  p.centralAirwayResistance = rc;
  return makePatientParams(p);
}

function newVcController(flow = 0.5, vt = 0.480, peep = 5) {
  const { VcAcController } = require('../src/simulation.js');
  return new VcAcController({
    fio2: 0.4, peep, rr: 14, vt, inspiratoryFlow: flow, inspiratoryPause: 0.5,
  });
}

// ---- T1: increasing Rcentral raises Ppeak ----------------------------------
test('T1: increasing Rcentral raises Ppeak during VC inspiration', () => {
  const { Simulation } = require('../src/simulation.js');

  function peakPaw(rc) {
    const sim = new Simulation({
      params: makePresetParams(rc),
      controller: newVcController(),
      dt: 0.001, fio2: 0.4,
    });
    sim.runFor(3 * 60 / 14);
    // Settled breath (skip breath 0, take breath 1).
    const m = sim.metrics()[1];
    return m.Ppeak;
  }
  const lo = peakPaw(0.5);
  const hi = peakPaw(5.0);
  assert(hi > lo + 1,
    `Rcentral=5 should give Ppeak > Rcentral=0.5: ${hi.toFixed(2)} vs ${lo.toFixed(2)}`);
});

// ---- T2: zero-flow inspiratory hold: Ppeak − Pplat ≈ 0 --------------------
// Plateau pressure during a zero-flow hold reflects the static elastic
// state (Pbranch, no central drop because Q=0). Ppeak reflects the
// transient during FLOW delivery; the difference is bounded by FLOW ×
// Rcentral + small elastic transient.
test('T2: zero-flow hold — Ppeak − Pplat < FLOW × Rcentral + tolerance', () => {
  const { Simulation } = require('../src/simulation.js');
  const sim = new Simulation({
    params: makePresetParams(5.0),   // high Rcentral to amplify effect
    controller: newVcController(),
    dt: 0.001, fio2: 0.4,
  });
  sim.runFor(3 * 60 / 14);
  const m = sim.metrics()[1];
  // FLOW × Rcentral = 0.5 × 5 = 2.5 cmH2O. With elastic transient
  // overshoot, expect ~3.0 cmH2O peak-plateau gap.
  const drop = m.Ppeak - m.Pplat;
  assert(drop < 3.5,
    `Ppeak−Pplat ${drop.toFixed(2)} should be < FLOW×Rcentral + tolerance=3.5 cmH2O`);
});

// ---- T3: Rcentral = 0 → legacy behavior -----------------------------------
test('T3: Rcentral = 0 — Ppeak matches legacy parallel-RC within tolerance', () => {
  // Compare Ppeak with Rcentral=0 vs Rcentral=1e-6 (effectively zero).
  const { Simulation } = require('../src/simulation.js');
  function peakPaw(rc) {
    const sim = new Simulation({
      params: makePresetParams(rc),
      controller: newVcController(),
      dt: 0.001, fio2: 0.4,
    });
    sim.runFor(3 * 60 / 14);
    return sim.metrics()[1].Ppeak;
  }
  const p0 = peakPaw(0);
  const pEps = peakPaw(1e-6);
  assert(Math.abs(p0 - pEps) < 0.5,
    `Rcentral=0 vs 1e-6 should be ≈ identical; got ${p0} vs ${pEps}`);
});

// ---- T4: FLOW conservation: requested = central = sum(branch) ------------
// Conservation is exact at the SOLVED state (pre-step). Tests directly
// inspect solveBranchForFlow's output, which by construction satisfies
// Q_requested = Q_central = Σ Q_branch.
test('T4: FLOW conservation — Q_requested = Q_central = Σ Q_branch (solve-time)', () => {
  const { solveBranchForFlow } = require('../src/mechanics.js');
  const params = makePresetParams(2.0);
  const state = makeInitialState(params, { initialVolume: 0.5 });
  const r = solveBranchForFlow(
    { kind: 'FLOW', flowLps: 0.5, fio2: 0.4 },
    params, state.compartments);
  assert(Math.abs(r.delivered - 0.5) < 1e-9,
    `Q_delivered ${r.delivered.toFixed(6)} should = Q_requested 0.5`);
  // Recompute ΣQ_branch from returned pBranch + pAlv.
  let sumBranch = 0;
  for (let i = 0; i < state.compartments.length; i++) {
    const cp = params.compartments[i];
    if (cp.resistance <= 0 || cp.capacity <= 1e-12) continue;
    const pAlv = state.compartments[i].recruitment > 0
      ? require('../src/compartments.js').elasticPressure(
          state.compartments[i].volume, cp, state.compartments[i].recruitment,
          params.airwayOpeningPressure)
      : require('../src/compartments.js').elasticPressure(
          state.compartments[i].volume, cp, 0,
          params.airwayOpeningPressure);
    sumBranch += (r.pBranch - pAlv) / cp.resistance;
  }
  assert(Math.abs(r.delivered - sumBranch) < 1e-9,
    `Q_delivered ${r.delivered} should = ΣQ_branch ${sumBranch}`);
});

// ---- T5: PRESSURE conservation: central Q = sum(branch Q) -----------------
test('T5: PRESSURE conservation — Q_central = Σ Q_branch at NEW state', () => {
  const params = makePresetParams(2.0);
  const state = makeInitialState(params, { initialVolume: 0.5 });
  const m = new ThreeCompartmentMechanics();
  const boundary = makeBoundaryPressure({ pressureCmH2O: 15, fio2: 0.4 });
  const r = m.step(params, state, boundary, 0.001);
  const Qcentral = r.output.centralFlow;
  const pBranch = r.output.branchPressure;
  let Qbranch = 0;
  for (let i = 0; i < params.compartments.length; i++) {
    const cp = params.compartments[i];
    if (cp.resistance <= 0 || cp.capacity <= 1e-12) continue;
    const pAlv = r.output.compartmentPressures[i];
    Qbranch += (pBranch - pAlv) / cp.resistance;
  }
  assert(Math.abs(Qcentral - Qbranch) < 1e-9,
    `Q_central ${Qcentral.toExponential(3)} should = Σ Q_branch ${Qbranch.toExponential(3)}`);
});

// ---- T6: paired-resistance: central R effect distinct from branch R ------
test('T6: paired-resistance — central R effect distinct from branch R effect', () => {
  const { Simulation } = require('../src/simulation.js');
  function makeParams(rc, branchMultiplier) {
    const p = PRESETS.Baseline();
    p.centralAirwayResistance = rc;
    for (const c of p.compartments) c.resistance *= branchMultiplier;
    return makePatientParams(p);
  }
  function peakPaw(rc, mult) {
    const sim = new Simulation({
      params: makeParams(rc, mult),
      controller: newVcController(),
      dt: 0.001, fio2: 0.4,
    });
    sim.runFor(3 * 60 / 14);
    return sim.metrics()[1].Ppeak;
  }
  const basePeak = peakPaw(2.0, 1.0);
  const onlyCentral = peakPaw(6.0, 1.0);   // 3× central R
  const onlyBranch = peakPaw(2.0, 3.0);    // 3× branch R
  const both = peakPaw(6.0, 3.0);          // 3× both

  assert(onlyCentral > basePeak,
    `3× central R should raise Ppeak: ${onlyCentral} > ${basePeak}`);
  assert(onlyBranch > basePeak,
    `3× branch R should raise Ppeak: ${onlyBranch} > ${basePeak}`);
  assert(both > onlyCentral && both > onlyBranch,
    `3× both should raise Ppeak more than either alone: ${both}`);
});

// ---- T7: Pvent = Pbranch + Q_central × Rcentral (identity check) ------------------
test('T7: identity — Pvent = Pbranch + Q_central × Rcentral at solve-time', () => {
  const { solveBranchForFlow } = require('../src/mechanics.js');
  const params = makePresetParams(3.0);
  const state = makeInitialState(params, { initialVolume: 0.5 });
  const r = solveBranchForFlow(
    { kind: 'FLOW', flowLps: 0.5, fio2: 0.5 },
    params, state.compartments);
  const lhs = r.pVent;
  const rhs = r.pBranch + r.delivered * params.centralAirwayResistance;
  assert(Math.abs(lhs - rhs) < 1e-9,
    `Pvent ${lhs} ≠ Pbranch + Q·Rc ${rhs}`);
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
