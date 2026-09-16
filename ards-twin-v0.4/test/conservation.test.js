// test/conservation.test.js — Milestone 2 acceptance: conservation at every
// step; integrated total flow = volume change; finite values; recruitment
// stays in [0,1].
//
// Per spec/TEST_PLAN.md §A.

const { ThreeCompartmentMechanics } = require('../src/mechanics.js');
const { makePatientParams, makeInitialState,
         makeBoundaryFlow, makeBoundaryPressure } = require('../src/contracts.js');
const { PRESETS } = require('../src/presets.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const mkParams = PRESETS.Baseline;

test('Initial state is finite', () => {
  const params = makePatientParams(mkParams());
  // v0.4.2: pressure-consistent init from AOP — zero volume since AOP=0
  // and distending pressure is zero.
  const state = makeInitialState(params, { initialPEEP: 5, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } });
  for (const c of state.compartments) {
    assert(Number.isFinite(c.volume), 'finite volume');
    assert(Number.isFinite(c.flow), 'finite flow');
    assert(Number.isFinite(c.alveolarPressure), 'finite alveolarP');
    assert(c.recruitment >= 0 && c.recruitment <= 1, 'r in [0,1]');
  }
  // v0.4.3: pressure-consistent init at preset's initialPEEP (5 for Baseline).
  assert(state.airwayPressure === 5, 'airwayPressure equals preset initialPEEP');
  assert(state.totalVolume >= 0, 'non-negative initial volume');
});

test('Single step produces finite values', () => {
  const params = makePatientParams(mkParams());
  const state = makeInitialState(params, { initialPEEP: 5, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } });
  const boundary = makeBoundaryFlow({ flowLps: 0.4, fio2: 0.5 });
  const m = new ThreeCompartmentMechanics();
  const { state: ns, output } = m.step(params, state, boundary, 0.001);
  for (const c of ns.compartments) {
    assert(Number.isFinite(c.volume), 'finite V');
    assert(Number.isFinite(c.flow), 'finite Q');
    assert(Number.isFinite(c.alveolarPressure), 'finite P');
  }
  assert(Number.isFinite(ns.airwayPressure), 'finite Paw');
  assert(output.compartmentVolumes.length === 3, 'three compartments');
});

test('Flow conservation per step', () => {
  // Total flow = sum of compartment flows within tolerance.
  const params = makePatientParams(mkParams());
  const state = makeInitialState(params, { initialPEEP: 5, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } });
  const m = new ThreeCompartmentMechanics();
  const boundary = makeBoundaryFlow({ flowLps: 0.5, fio2: 0.5 });
  const { output } = m.step(params, state, boundary, 0.001);
  const sumComp = output.compartmentFlows.reduce((s, x) => s + x, 0);
  assert(Math.abs(sumComp - output.airwayFlow) < 1e-12,
    `airwayFlow ${output.airwayFlow} ≠ sum comp ${sumComp}`);
});

test('Volume change equals integrated flow', () => {
  // ΔV_total = Σ Q_i × dt within tolerance.
  const params = makePatientParams(PRESETS['Injury B']());
  const state = makeInitialState(params, { initialPEEP: 5, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } });
  const m = new ThreeCompartmentMechanics();
  const dt = 0.005;
  const boundary = makeBoundaryFlow({ flowLps: 0.4, fio2: 0.5 });
  const before = state.totalVolume;
  const { output, state: ns } = m.step(params, state, boundary, dt);
  const expectedDv = output.airwayFlow * dt;
  const actualDv = ns.totalVolume - before;
  assert(Math.abs(actualDv - expectedDv) < 1e-9,
    `ΔV ${actualDv} ≠ Q×dt ${expectedDv}`);
});

test('Pressure boundary type is honoured', () => {
  const params = makePatientParams(mkParams());
  const state = makeInitialState(params, { initialPEEP: 5, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } });
  const m = new ThreeCompartmentMechanics();
  const boundary = makeBoundaryPressure({ pressureCmH2O: 10, fio2: 0.5 });
  const { state: ns } = m.step(params, state, boundary, 0.001);
  assert(Math.abs(ns.airwayPressure - 10) < 1e-9,
    `Paw should be 10, got ${ns.airwayPressure}`);
});

test('Volume cannot go negative under passive recoil', () => {
  // Sustained Paw = AOP (zero driving pressure with relaxed compartments).
  const params = makePatientParams(PRESETS['Injury C']());
  const state = makeInitialState(params, { initialPEEP: 0, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } });
  const m = new ThreeCompartmentMechanics();
  const boundary = makeBoundaryPressure({ pressureCmH2O: 0, fio2: 0.5 });
  const { state: ns } = m.step(params, state, boundary, 0.01);
  for (const c of ns.compartments) {
    assert(c.volume >= 0, `volume went negative: ${c.volume}`);
  }
});

test('Recruitment bounds are preserved', () => {
  const params = makePatientParams(PRESETS['Injury C']());
  const state = makeInitialState(params, { initialPEEP: 5, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } });
  // v0.4: recruitment evolves via opening/closing dynamics. The test now
  // verifies that the state stays within [0, 1] regardless of starting value
  // and that opening/closing behavior is monotone (no spontaneous jumps).
  state.compartments[1].recruitment = 0.4;
  const m = new ThreeCompartmentMechanics();
  const boundary = makeBoundaryFlow({ flowLps: 0.5, fio2: 0.5 });
  const { state: ns } = m.step(params, state, boundary, 0.001);
  const r = ns.compartments[1].recruitment;
  assert(r >= 0 && r <= 1,
    `recruitment out of [0,1]: ${r}`);
  // Drift is bounded — at dt=1 ms with P_alv well below P_close (15 cmH2O),
  // closing rate k_close × (P_close − P_alv) × dt ≈ small.
  assert(Math.abs(r - 0.4) < 0.05,
    `recruitment drifted too far: ${r}`);
});

test('Reject bad patient params', () => {
  // Tissue fractions not summing to 1.
  let threw = 0;
  try {
    makePatientParams({
      compartments: [{
        id: 'normal', fraction: 0.5, resistance: 1,
        capacity: 3.5, elasticScale: 1,
        perfusionFraction: 0.5, deadSpaceFraction: 0.3,
      }, {
        id: 'recruitable', fraction: 0.3, resistance: 1,
        capacity: 1.0, elasticScale: 1,
        perfusionFraction: 0.3, deadSpaceFraction: 0.3,
      }, {
        id: 'consolidated', fraction: 0.1, resistance: 1,
        capacity: 0.001, elasticScale: 1,
        perfusionFraction: 0.2, deadSpaceFraction: 0.3,
      }],
      centralAirwayResistance: 2.5,
      airwayOpeningPressure: 0,
    });
  } catch (_) { threw++; }
  assert(threw === 1, `expected throw, got ${threw}`);
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
