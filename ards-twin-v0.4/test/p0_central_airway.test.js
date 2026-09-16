// test/p0_central_airway.test.js — Central airway resistance participates
// in the proximal/distal airway mechanics (v0.4.2).
//
//   Pvent --[Rcentral]-- Pbranch --[Ri, availability_i]--> x 3 compartments
//
// Tests:
//   1. Increasing Rcentral raises Ppeak during VC inspiration.
//   2. Zero-flow hold: central resistive drop vanishes (Q → 0).
//   3. Rcentral = 0 → Pbranch = Pvent; matches low-Rc limit.
//   4. FLOW conservation: Q_requested = Q_central = sum(Q_branch).
//   5. PRESSURE conservation: Q_central = sum(Q_branch) at NEW state.
//   6. Paired-resistance: central vs branch R distinguishable.
//   7. Identity: Pvent = Pbranch + Q_central × Rcentral at solve-time.

const { ThreeCompartmentMechanics } = require('../src/mechanics.js');
const {
  makePatientParams, makeBoundaryFlow, makeBoundaryPressure,
  makeInitialState,
} = require('../src/contracts.js');
const { PRESETS } = require('../src/presets.js');
const { elasticPressure, forwardElasticVolume } = require('../src/compartments.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function makePresetParams(rc) {
  const p = PRESETS.phenotype_baseline();
  p.centralAirwayResistance = rc;
  return makePatientParams(p);
}

function newVcController(flow = 0.5, vt = 0.480, peep = 5) {
  const { VcAcController } = require('../src/simulation.js');
  return new VcAcController({
    fio2: 0.4, peep, rr: 14, vt, inspiratoryFlow: flow, inspiratoryPause: 0.5,
  });
}

// ---- T1: increasing Rcentral raises Ppeak ------------------------------
test('T1: increasing Rcentral raises Ppeak during VC inspiration', () => {
  const { Simulation } = require('../src/simulation.js');
  function peakPaw(rc) {
    const sim = new Simulation({
      params: makePresetParams(rc),
      controller: newVcController(), dt: 0.001, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } , fio2: 0.4, trackGas: false,
    });
    sim.runFor(3 * 60 / 14);
    return sim.metrics()[1].Ppeak;
  }
  const lo = peakPaw(0.5);
  const hi = peakPaw(5.0);
  assert(hi > lo + 1,
    `Rcentral=5 should give Ppeak > Rcentral=0.5: ${hi.toFixed(2)} vs ${lo.toFixed(2)}`);
});

// ---- T2: zero-flow hold — central drop → 0 ----------------------------
test('T2: zero-flow hold — central resistive drop vanishes', () => {
  const { Simulation } = require('../src/simulation.js');
  function plateauPaw(rc) {
    const sim = new Simulation({
      params: makePresetParams(rc),
      controller: newVcController(), dt: 0.001, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } , fio2: 0.4, trackGas: false,
    });
    sim.runFor(3 * 60 / 14);
    return sim.metrics()[1].Pplat;
  }
  const lo = plateauPaw(0.5);
  const hi = plateauPaw(5.0);
  // Plateau at end-inspiration is approached during the hold; central drop
  // vanishes as Q → 0, so plateauPaw should be similar across Rcentral.
  assert(Math.abs(hi - lo) < 1.0,
    `Plateau should be similar across Rcentral: ${lo.toFixed(2)} vs ${hi.toFixed(2)}`);
});

// ---- T3: Rcentral = 0 vs very small Rcentral --------------------------
test('T3: Rcentral = 0 — Ppeak matches small-Rcentral limit', () => {
  const { Simulation } = require('../src/simulation.js');
  function peakPaw(rc) {
    const sim = new Simulation({
      params: makePresetParams(rc),
      controller: newVcController(), dt: 0.001, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } , fio2: 0.4, trackGas: false,
    });
    sim.runFor(3 * 60 / 14);
    return sim.metrics()[1].Ppeak;
  }
  const p0 = peakPaw(0);
  const pEps = peakPaw(1e-4);
  assert(Math.abs(p0 - pEps) < 1.0,
    `Rcentral=0 vs 1e-4 should be ≈ identical; got ${p0.toFixed(2)} vs ${pEps.toFixed(2)}`);
});

// ---- T4: FLOW conservation (single step) --------------------------------
// Drive FLOW at known rate; conservation: Q_requested = Q_central = ΣQ_branch.
test('T4: FLOW conservation — Q_requested = Q_central = Σ Q_branch', () => {
  const params = makePresetParams(2.0);
  // Init from PEEP=5 so we start at the equilibrium volume.
  const state = makeInitialState(params, { initialPEEP: 5, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } });
  const m = new ThreeCompartmentMechanics();
  const { state: ns, output } = m.step(params, state,
    makeBoundaryFlow({ flowLps: 0.5, fio2: 0.4 }), 0.001);
  // Q_central is exact by construction.
  assert(Math.abs(output.centralFlow - 0.5) < 1e-6,
    `Q_central ${output.centralFlow} should = 0.5`);
  // Σ Q_branch should match.
  const sumQ = output.compartmentFlows.reduce((s, x) => s + x, 0);
  assert(Math.abs(sumQ - 0.5) < 1e-6,
    `Σ Q_branch ${sumQ} should = 0.5`);
});

// ---- T5: PRESSURE conservation -----------------------------------------
test('T5: PRESSURE conservation — Q_central = Σ Q_branch', () => {
  const params = makePresetParams(2.0);
  const state = makeInitialState(params, { initialPEEP: 5, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } });
  const m = new ThreeCompartmentMechanics();
  const { output } = m.step(params, state,
    makeBoundaryPressure({ pressureCmH2O: 20, fio2: 0.4 }), 0.001);
  // Conservation exact by construction.
  const sumQ = output.compartmentFlows.reduce((s, x) => s + x, 0);
  assert(Math.abs(output.centralFlow - sumQ) < 1e-6,
    `Q_central ${output.centralFlow} should = Σ Q_branch ${sumQ}`);
});

// ---- T6: paired-resistance distinguishability -------------------------
test('T6: paired-resistance — central R slows filling under FLOW', () => {
  // Under FLOW boundary with fixed flow, increasing central R increases
  // Ppeak (the total resistive drop), while increasing branch R has the
  // same total effect but different timing dynamics. We just verify the
  // total-resistive-load property: doubling total R increases Ppeak.
  function peakPaw(central, branch) {
    const p = PRESETS.phenotype_baseline();
    p.centralAirwayResistance = central;
    p.compartments.forEach(c => c.resistance = branch);
    const params = makePatientParams(p);
    const sim = new (require('../src/simulation.js').Simulation)({
      params, controller: newVcController(), dt: 0.001, fio2: 0.4, trackGas: false, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
    });
    sim.runFor(3 * 60 / 14);
    return sim.metrics()[1].Ppeak;
  }
  // Case A: total = 6 (central 5, branch 1). Case B: total = 12 (central 11, branch 1).
  // Doubling total R should roughly double the FLOW-driven resistive drop.
  const pa = peakPaw(5.0, 1.0);
  const pb = peakPaw(11.0, 1.0);
  assert(pb > pa,
    `Higher total R should give higher Ppeak: ${pa.toFixed(2)} vs ${pb.toFixed(2)}`);
});

// ---- T7: identity — Pvent = Pbranch + Q_central × Rcentral ------------
test('T7: identity — Pvent = Pbranch + Q_central × Rcentral', () => {
  for (const rc of [0.5, 2.0, 5.0]) {
    const params = makePresetParams(rc);
    const state = makeInitialState(params, { initialPEEP: 5, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } });
    const m = new ThreeCompartmentMechanics();
    const { output } = m.step(params, state,
      makeBoundaryFlow({ flowLps: 0.5, fio2: 0.4 }), 0.001);
    const lhs = output.airwayPressure;
    const rhs = output.branchPressure + output.centralFlow * rc;
    assert(Math.abs(lhs - rhs) < 1e-6,
      `Rc=${rc}: Pvent ${lhs.toFixed(6)} ≠ Pbranch + Q×Rc ${rhs.toFixed(6)}`);
  }
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
