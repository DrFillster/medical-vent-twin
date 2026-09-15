// test/p0_single_compartment.test.js — P0-2: audit the elastic/mechanics
// contract — single-compartment analytic equilibrium check.
//
// Validates the equation P = V × K / (capacity × capMult(r)) + AOP.
// At equilibrium with Rcentral = 0, P_branch = Paw (fixed), and
// V_eq = (Paw − AOP) × capEff / K.

const { ThreeCompartmentMechanics } = require('../src/mechanics.js');
const {
  makePatientParams, makeBoundaryPressure, makeInitialState,
} = require('../src/contracts.js');
const { elasticPressure, effectiveCapacity } = require('../src/compartments.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function singleParams(K, capacity, R, aop = 0) {
  return makePatientParams({
    compartments: [
      { id:'normal', fraction:1.0, resistance:R, capacity,
        elasticScale:K, perfusionFraction:1.0, deadSpaceFraction:0.3 },
      { id:'recruitable', fraction:0, resistance:1, capacity:1e-6,
        elasticScale:1, perfusionFraction:0, deadSpaceFraction:0.3 },
      { id:'consolidated', fraction:0, resistance:1, capacity:1e-6,
        elasticScale:1, perfusionFraction:0, deadSpaceFraction:0.3 },
    ],
    centralAirwayResistance: 0,
    airwayOpeningPressure: aop,
  });
}

function runToEquilibrium(params, Paw, dt = 0.001) {
  const state = makeInitialState(params, { initialVolume: 0 });
  const m = new ThreeCompartmentMechanics();
  let s = state;
  // Use the slowest compartment τ to be conservative.
  let maxTau = 0;
  for (const c of params.compartments) {
    if (c.capacity > 1e-12) {
      const tau = c.resistance * (c.capacity / c.elasticScale);
      if (tau > maxTau) maxTau = tau;
    }
  }
  const steps = Math.ceil(10 * maxTau / dt);
  for (let i = 0; i < steps; i++) {
    s = m.step(params, s,
      makeBoundaryPressure({ pressureCmH2O: Paw, fio2: 0.5 }), dt).state;
  }
  return s;
}

// ---- T1: elastic law direct computation ---------------------------------
test('elasticPressure at equilibrium: P = (Paw − AOP) × K/capEff', () => {
  const K = 30, capacity = 1.0, Paw = 12, AOP = 0;
  const cp = { capacity, elasticScale: K };
  const capEff = effectiveCapacity(cp, 0);
  const Veq = (Paw - AOP) * capEff / K;
  const pAlv = elasticPressure(Veq, cp, 0, AOP);
  assert(Math.abs(pAlv - Paw) < 1e-9,
    `elasticPressure(Veq) should = Paw: ${pAlv.toFixed(6)} vs ${Paw}`);
});

// ---- T2: integration reaches analytic V_eq -----------------------------
test('Single compartment reaches analytic V_eq from zero within 8τ', () => {
  const K = 30, capacity = 1.0, R = 5;
  const C = capacity / K;
  const Paw = 12;
  const params = singleParams(K, capacity, R);
  const s = runToEquilibrium(params, Paw);
  const Veq = C * Paw;
  const rel = Math.abs(s.totalVolume - Veq) / Veq;
  assert(rel < 0.02,
    `V_eq expected ${Veq.toFixed(4)}, got ${s.totalVolume.toFixed(4)} (rel ${rel.toFixed(3)})`);
});

// ---- T3: AOP shifts V_eq -----------------------------------------------
test('AOP shifts V_eq: V_eq = (Paw − AOP) × C', () => {
  const K = 30, capacity = 1.0, R = 5, AOP = 5;
  const C = capacity / K;
  const Paw = 12;
  const params = singleParams(K, capacity, R, AOP);
  const s = runToEquilibrium(params, Paw);
  const Veq = (Paw - AOP) * C;
  const rel = Math.abs(s.totalVolume - Veq) / Math.abs(Veq);
  assert(rel < 0.02,
    `V_eq with AOP expected ${Veq.toFixed(4)}, got ${s.totalVolume.toFixed(4)} (rel ${rel.toFixed(3)})`);
});

// ---- T4: doubling capacity doubles V_eq ---------------------------------
test('Doubling capacity doubles V_eq at fixed K', () => {
  function VeqAt(cap) {
    const params = singleParams(30, cap, 5);
    return runToEquilibrium(params, 12).totalVolume;
  }
  const v1 = VeqAt(1.0);
  const v2 = VeqAt(2.0);
  const ratio = v2 / v1;
  assert(Math.abs(ratio - 2.0) < 0.02,
    `Doubling capacity should double V_eq: ratio=${ratio.toFixed(3)}`);
});

// ---- T5: doubling K halves V_eq -----------------------------------------
test('Doubling elasticScale halves V_eq at fixed capacity', () => {
  function VeqAt(K) {
    const params = singleParams(K, 1.0, 5);
    return runToEquilibrium(params, 12).totalVolume;
  }
  const v1 = VeqAt(30);
  const v2 = VeqAt(60);
  const ratio = v2 / v1;
  assert(Math.abs(ratio - 0.5) < 0.02,
    `Doubling K should halve V_eq: ratio=${ratio.toFixed(3)}`);
});

// ---- T6: capacity-0 placeholder compartments are inert ------------------
test('Capacity-0 placeholder compartments do not affect equilibrium', () => {
  const params = singleParams(30, 1.0, 5);
  const s = runToEquilibrium(params, 12);
  assert(Math.abs(s.totalVolume - 0.4) < 0.01,
    `V_eq expected 0.4 L (12/30), got ${s.totalVolume.toFixed(4)}`);
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
