// test/p0_single_compartment.test.js — Mechanics contract audit (v0.4.2).
//
// The elastic law is now the finite-capacity exponential form:
//   p_el(V) = -K * ln(1 - V/Vmax)   for 0 ≤ V < Vmax = capacity
//   V(P)    = capacity * (1 - exp(-(P-AOP)/K))  for P ≥ AOP
//
// Tests verify the constitutive law, single-compartment equilibrium, and
// scaling properties.

const { ThreeCompartmentMechanics } = require('../src/mechanics.js');
const {
  makePatientParams, makeBoundaryPressure, makeInitialState,
} = require('../src/contracts.js');
const {
  elasticPressure, elasticPressureAboveAOP, forwardElasticVolume,
  fullCompliance, tangentCompliance, dPressureDVolume,
  effectiveVolumeCapacity, clampVolume, EPS_CAP,
} = require('../src/compartments.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function singleParams(K, capacity, R, aop = 0) {
  return makePatientParams({
    compartments: [
      { id: 'normal', fraction: 1.0, resistance: R, capacity,
        elasticScale: K, perfusionFraction: 1.0, deadSpaceFraction: 0.3 },
      { id: 'recruitable', fraction: 0, resistance: 1, capacity: 1e-6,
        elasticScale: 1, perfusionFraction: 0, deadSpaceFraction: 0.3 },
      { id: 'consolidated', fraction: 0, resistance: 1, capacity: 1e-6,
        elasticScale: 1, perfusionFraction: 0, deadSpaceFraction: 0.3 },
    ],
    centralAirwayResistance: 0,
    airwayOpeningPressure: aop,
  });
}

function runToSteadyState(params, Paw, dt = 0.001, maxSteps = 60000) {
  // Pressure-consistent init from AOP (zero volume since AOP=0 unless told).
  const state = makeInitialState(params, { initialPEEP: 0, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } });
  const m = new ThreeCompartmentMechanics();
  let s = state;
  for (let i = 0; i < maxSteps; i++) {
    s = m.step(params, s,
      makeBoundaryPressure({ pressureCmH2O: Paw, fio2: 0.5 }), dt).state;
  }
  return s;
}

// ---- A1: forward/inverse identity --------------------------------------
test('A1: forward/inverse identity V(P) <-> p(V)', () => {
  const cp = { capacity: 2.0, elasticScale: 30, id: 'normal', resistance: 1 };
  for (const p of [0.5, 1.0, 5.0, 12.0, 25.0]) {
    const V = forwardElasticVolume(p, cp, 1.0, 0);
    const pRecovered = elasticPressureAboveAOP(V, cp, 1.0);
    assert(Math.abs(pRecovered - p) < 1e-10,
      `p=${p} → V=${V} → p'=${pRecovered}`);
  }
});

// ---- A2: low-pressure compliance matches C_full ------------------------
test('A2: low-pressure compliance → C_full', () => {
  const K = 30, capacity = 1.0;
  const cp = { capacity, elasticScale: K, id: 'normal', resistance: 1 };
  const Cfull = fullCompliance(cp);
  // At V = Cfull * dp, dV/dP should approach Cfull.
  const dp = 1e-3;
  const V0 = forwardElasticVolume(dp, cp, 1.0, 0);
  const V1 = forwardElasticVolume(2 * dp, cp, 1.0, 0);
  const numCtan = (V1 - V0) / dp;
  assert(Math.abs(numCtan - Cfull) / Cfull < 0.01,
    `numerical Ctan ${numCtan} should ≈ C_full ${Cfull}`);
});

// ---- A3: finite-capacity asymptote -------------------------------------
test('A3: V → Vmax as P → ∞ (never exceeds)', () => {
  const cp = { capacity: 1.0, elasticScale: 30, id: 'normal', resistance: 1 };
  for (const [p, eps] of [[100, 0.05], [200, 0.005], [1000, 1e-12]]) {
    const V = forwardElasticVolume(p, cp, 1.0, 0);
    assert(V <= cp.capacity,
      `V=${V} exceeds capacity ${cp.capacity} at p=${p}`);
    assert(cp.capacity - V < eps,
      `V=${V} should approach capacity ${cp.capacity} at p=${p} (gap=${cp.capacity - V})`);
  }
});

// ---- A4: tangent compliance collapses near capacity --------------------
test('A4: Ctan decreases monotonically as V → Vmax', () => {
  const cp = { capacity: 1.0, elasticScale: 30, id: 'normal', resistance: 1 };
  const v0 = cp.capacity * 0.1;
  const v1 = cp.capacity * 0.5;
  const v2 = cp.capacity * 0.9;
  const c0 = tangentCompliance(v0, cp, 1.0);
  const c1 = tangentCompliance(v1, cp, 1.0);
  const c2 = tangentCompliance(v2, cp, 1.0);
  assert(c0 > c1 && c1 > c2,
    `Ctan should decrease with V: ${c0} > ${c1} > ${c2}`);
});

// ---- A5: invalid state rejection ---------------------------------------
test('A5: V ≥ Vmax is rejected (no hard clip)', () => {
  const cp = { capacity: 1.0, elasticScale: 30, id: 'normal', resistance: 1 };
  let threw = 0;
  try {
    clampVolume(cp.capacity * 1.1, cp, 1.0);
  } catch (e) { threw++; }
  assert(threw === 1, `expected throw for V > Vmax`);
  let threw2 = 0;
  try {
    elasticPressureAboveAOP(cp.capacity, cp, 1.0);
  } catch (e) { threw2++; }
  assert(threw2 === 1, `expected throw for V >= Vmax`);
});

// ---- B1: pressure-step equilibrium -------------------------------------
test('B1: single compartment reaches analytic V_eq', () => {
  const K = 30, capacity = 1.0, R = 5;
  const Paw = 12;
  const params = singleParams(K, capacity, R);
  const s = runToSteadyState(params, Paw);
  const Veq = forwardElasticVolume(Paw, params.compartments[0], 1.0, 0);
  const rel = Math.abs(s.totalVolume - Veq) / Veq;
  assert(rel < 0.02,
    `V_eq expected ${Veq.toFixed(4)}, got ${s.totalVolume.toFixed(4)}`);
});

// ---- B2: AOP shift preserves elastic volume ----------------------------
test('B2: AOP shift preserves distending-pressure equilibrium', () => {
  // V(Paw-AOP, AOP) = V(Paw'=AOP+0, AOP=0) when the distending pressure
  // is held constant. We compare V_eq at Paw=12, AOP=0 vs Paw=15, AOP=3.
  const K = 30, capacity = 1.0, R = 5;
  const params1 = singleParams(K, capacity, R, 0);
  const params2 = singleParams(K, capacity, R, 3);
  const s1 = runToSteadyState(params1, 12);
  const s2 = runToSteadyState(params2, 15);
  // V_eq at distending pressure 12 should match in both.
  const V1 = forwardElasticVolume(12, params1.compartments[0], 1.0, 0);
  const V2 = forwardElasticVolume(15, params2.compartments[0], 1.0, 3);
  assert(Math.abs(V1 - V2) < 1e-10,
    `V_eq at distending pressure 12: ${V1} vs ${V2}`);
  // Both compartments reach analytic equilibrium.
  assert(Math.abs(s1.totalVolume - V1) / V1 < 0.02,
    `params1 V ${s1.totalVolume} should ≈ ${V1}`);
  assert(Math.abs(s2.totalVolume - V2) / V2 < 0.02,
    `params2 V ${s2.totalVolume} should ≈ ${V2}`);
});

// ---- B3: scaling — doubling capacity doubles V_eq ----------------------
test('B3: doubling capacity doubles V_eq', () => {
  const K = 30, R = 5, Paw = 8;
  const params1 = singleParams(K, 1.0, R);
  const params2 = singleParams(K, 2.0, R);
  const s1 = runToSteadyState(params1, Paw);
  const s2 = runToSteadyState(params2, Paw);
  const ratio = s2.totalVolume / s1.totalVolume;
  assert(Math.abs(ratio - 2.0) < 0.02,
    `Doubling capacity should double V_eq: ratio=${ratio.toFixed(3)}`);
});

// ---- B4: scaling — K affects V_eq non-linearly ------------------------
test('B4: V_eq is the forward exponential form', () => {
  // Compare analytic V(P) to the simulation for several K values.
  const Ks = [10, 30, 60];
  const capacity = 1.0, R = 5, Paw = 12;
  for (const K of Ks) {
    const params = singleParams(K, capacity, R);
    const s = runToSteadyState(params, Paw);
    const Veq = forwardElasticVolume(Paw, params.compartments[0], 1.0, 0);
    const rel = Math.abs(s.totalVolume - Veq) / Math.max(Veq, 1e-6);
    assert(rel < 0.02,
      `K=${K}: V ${s.totalVolume.toFixed(4)} should ≈ ${Veq.toFixed(4)}`);
  }
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
