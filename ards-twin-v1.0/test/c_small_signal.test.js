// test/c_small_signal.test.js — v0.4.3 acceptance tests (Section C).
//
// At a single-compartment equilibrium, the small-signal RC dynamics has
// time constant τ ≈ R · C_tan where C_tan = (dP/dV)^-1.

const assert = require('node:assert/strict');
const { makePatientParams, makeBoundaryPressure,
        makeCompartmentParams } = require('../src/contracts.js');
const { forwardElasticVolume, dPressureDVolume } = require('../src/compartments.js');
const { ThreeCompartmentMechanics } = require('../src/mechanics.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok  -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}

function approx(a, b, tol) { return Math.abs(a - b) <= tol; }

function singleComp(K, capacity, R, peep) {
  return makePatientParams({
    compartments: [
      makeCompartmentParams({ id: 'normal', fraction: 1.0, resistance: R,
        capacity, elasticScale: K, perfusionFraction: 1.0, deadSpaceFraction: 0.3 }),
      makeCompartmentParams({ id: 'recruitable', fraction: 0, resistance: 1,
        capacity: 1e-6, elasticScale: 1, perfusionFraction: 0, deadSpaceFraction: 0.3 }),
      makeCompartmentParams({ id: 'consolidated', fraction: 0, resistance: 1,
        capacity: 1e-6, elasticScale: 1, perfusionFraction: 0, deadSpaceFraction: 0.3 }),
    ],
    centralAirwayResistance: 0,
    airwayOpeningPressure: 0,
    initialPEEP: peep,
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
  });
}

function stepUntilV(params, targetV, maxIter = 200000) {
  const cp = params.compartments[0];
  const m = new ThreeCompartmentMechanics();
  const peep = params.initialPEEP;
  let s = require('../src/contracts.js').makeInitialState(params,
    { initialPEEP: peep,
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
      initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } });
  const boundary = makeBoundaryPressure({ pressureCmH2O: peep, fio2: 0.5 });
  for (let i = 0; i < maxIter; i++) {
    s = m.step(params, s, boundary, 0.001).state;
    if (Math.abs(s.totalVolume - targetV) < 1e-3) return s;
  }
  return s;
}

// C: small-signal dynamics
test('C: tau ≈ R · C_tan at single-compartment equilibrium', () => {
  const K = 30, capacity = 1.0, R = 5, peep = 10;
  const params = singleComp(K, capacity, R, peep);

  // Operating point V_eq at PEEP
  const V_eq = forwardElasticVolume(peep, params.compartments[0], 1, 0);
  // C_tan = (dP/dV)^-1 at V_eq
  const dPdV = dPressureDVolume(V_eq, params.compartments[0], 1);
  const C_tan = 1 / dPdV;
  const tau_expected = R * C_tan;   // seconds

  // Simulate a small step ΔP above peep and measure τ to reach new equilibrium.
  const newPeep = peep + 1.0;  // 1 cmH2O step
  const V_target = forwardElasticVolume(newPeep, params.compartments[0], 1, 0);

  const m = new ThreeCompartmentMechanics();
  const initState = require('../src/contracts.js').makeInitialState(params, {
    initialPEEP: peep,
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
  });
  const boundary = makeBoundaryPressure({ pressureCmH2O: newPeep, fio2: 0.5 });
  let s = initState;
  // Step until V reaches 1/e ≈ 0.368 of the way from V_eq to V_target.
  const V_63pct = V_eq + (V_target - V_eq) * (1 - 1 / Math.E);
  let t_at_63 = -1;
  const dt = 0.001;
  for (let i = 0; i < 200000; i++) {
    s = m.step(params, s, boundary, dt).state;
    if (t_at_63 < 0 && s.totalVolume >= V_63pct) {
      t_at_63 = s.t;
      break;
    }
  }
  assert(t_at_63 > 0, 'V reached 63% of new equilibrium');
  // τ_expected = R * C_tan. We measured the time to reach (1 - 1/e) of new
  // equilibrium, which is one τ after the step. So t_at_63 ≈ tau_expected.
  const rel = Math.abs(t_at_63 - tau_expected) / tau_expected;
  // Tolerate 30% — small-signal is approximate.
  assert(rel < 0.30,
    `measured τ=${t_at_63.toFixed(3)}s, expected τ=${tau_expected.toFixed(3)}s ` +
    `(C_tan=${C_tan.toFixed(4)}, R=${R}, V_eq=${V_eq.toFixed(4)}, V_target=${V_target.toFixed(4)})`);
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
