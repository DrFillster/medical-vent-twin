// test/single_rc.test.js — Milestone 2 acceptance: single linear RC compartment
// against analytic exponential filling/emptying behavior.
//
// Analytic limit (PRESSURE boundary, Paw fixed):
//   dV/dt = (Paw − V/C) / R  with V(0)=0
//   V_eq = C × Paw
//   V(t) = V_eq × (1 − exp(−t/τ))   where τ = R × C
//
// We model the lung as one functional compartment plus two negligible
// compartments and compare the numerical V(t) to the analytic form.

const { ThreeCompartmentMechanics } = require('../src/mechanics.js');
const { makePatientParams, makeBoundaryPressure,
         makeInitialState } = require('../src/contracts.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function makeRcParams({ R = 5, capacity = 1.0, elasticScale = 1.0 }) {
  return {
    compartments: [
      {
        id: 'normal', fraction: 1.0, resistance: R,
        capacity, elasticScale,
        perfusionFraction: 1.0, deadSpaceFraction: 0.3,
      }, {
        id: 'recruitable', fraction: 0.0, resistance: 1,
        capacity: 1e-6, elasticScale: 1,
        perfusionFraction: 0.0, deadSpaceFraction: 0.3,
      }, {
        id: 'consolidated', fraction: 0.0, resistance: 1,
        capacity: 1e-6, elasticScale: 1,
        perfusionFraction: 0.0, deadSpaceFraction: 0.3,
      },
    ],
    centralAirwayResistance: 0,
    airwayOpeningPressure: 0,
  };
}

test('Single RC: exponential approach to analytic equilibrium', () => {
  const R = 5, elasticScale = 1.0, capacity = 1.0;
  const C = capacity / elasticScale;
  const Paw = 12;
  const tau = R * C;
  const params = makePatientParams(makeRcParams({ R, capacity, elasticScale }));
  const state = makeInitialState(params, { initialVolume: 0 });
  const m = new ThreeCompartmentMechanics();
  const dt = 0.001;
  let s = state;
  const steps = Math.ceil(8 * tau / dt);
  for (let i = 0; i < steps; i++) {
    s = m.step(params, s,
      makeBoundaryPressure({ pressureCmH2O: Paw, fio2: 0.5 }), dt).state;
  }
  const Veq = C * Paw;
  const expectedAt8Tau = Veq * (1 - Math.exp(-8));
  const rel = Math.abs(s.totalVolume - expectedAt8Tau) / expectedAt8Tau;
  assert(rel < 0.05,
    `V(8τ) expected ${expectedAt8Tau.toFixed(4)} L, got ${s.totalVolume.toFixed(4)} L (rel ${rel.toFixed(3)})`);
});

test('Single RC: very low resistance, V approaches analytic V_eq', () => {
  // With R small but finite, V approaches equilibrium quickly.
  // (For truly R=0, the analytic flow would be infinite; we test the
  // small-but-finite case.)
  const R = 0.1, C = 1.0, Paw = 5;
  const params = makePatientParams(makeRcParams({
    R, capacity: 1, elasticScale: 1,
  }));
  const state = makeInitialState(params, { initialVolume: 0 });
  const m = new ThreeCompartmentMechanics();
  const dt = 0.001;
  let s = state;
  // 8 × τ should reach >99.9% of equilibrium.
  for (let i = 0; i < Math.ceil(8 * R * C / dt); i++) {
    s = m.step(params, s,
      makeBoundaryPressure({ pressureCmH2O: Paw, fio2: 0.5 }), dt).state;
  }
  const Veq = C * Paw;
  const rel = Math.abs(s.totalVolume - Veq) / Veq;
  assert(rel < 0.02,
    `V_∞ expected ${Veq.toFixed(4)} L, got ${s.totalVolume.toFixed(4)} L (rel ${rel.toFixed(3)})`);
});

test('Single RC: increasing resistance delays filling', () => {
  // Two single-RC compartments with different R but same Paw; the higher-R
  // compartment fills more slowly at intermediate times.
  const makeHigh = (R) => makeRcParams({ R, capacity: 1, elasticScale: 1 });
  const paramsLo = makePatientParams(makeHigh(2));
  const paramsHi = makePatientParams(makeHigh(20));

  const state0 = () => makeInitialState(makePatientParams(makeHigh(2)), { initialVolume: 0 });
  const sLo = state0();
  const sHi = makeInitialState(paramsHi, { initialVolume: 0 });

  const m = new ThreeCompartmentMechanics();
  const dt = 0.001;
  let lo = sLo, hi = sHi;
  const steps = 2000;
  for (let i = 0; i < steps; i++) {
    lo = m.step(paramsLo, lo,
      makeBoundaryPressure({ pressureCmH2O: 10, fio2: 0.5 }), dt).state;
    hi = m.step(paramsHi, hi,
      makeBoundaryPressure({ pressureCmH2O: 10, fio2: 0.5 }), dt).state;
  }
  // After 2 seconds with τ_lo=2 and τ_hi=20, both have approached their
  // 1/(1-e) asymptote, but the higher-R one should be closer to equilibrium
  // (it's at 2×τ = 86% of equilibrium vs ~63% for low-R? Wait, high-R
  // means slow, so it lags. Lower-R catches up faster.)
  // Anyway: at intermediate step counts the low-R is ahead of the high-R.
  // After 2 seconds:
  //  - τ_lo = 2 s, fraction 1−e^(−1) = 0.632
  //  - τ_hi = 20 s, fraction 1−e^(−0.1) = 0.0952
  // Both fill toward C × Paw = 10 L but the low-R reaches much further.
  assert(lo.totalVolume > hi.totalVolume,
    `low-R should fill ahead of high-R: lo=${lo.totalVolume.toFixed(3)}, hi=${hi.totalVolume.toFixed(3)}`);
});

test('Single RC: increasing V/Stiffness scales with C linearly', () => {
  // Doubling capacity (doubling C) at fixed Paw should double V_eq.
  const params1 = makePatientParams(makeRcParams({ R: 5, capacity: 1.0, elasticScale: 1.0 }));
  const params2 = makePatientParams(makeRcParams({ R: 5, capacity: 2.0, elasticScale: 1.0 }));

  const m = new ThreeCompartmentMechanics();
  const dt = 0.01;
  const Paw = 10;

  function fillToSteadyState(params) {
    let s = makeInitialState(params, { initialVolume: 0 });
    for (let i = 0; i < 8000; i++) {
      s = m.step(params, s,
        makeBoundaryPressure({ pressureCmH2O: Paw, fio2: 0.5 }), dt).state;
    }
    return s;
  }
  const v1 = fillToSteadyState(params1);
  const v2 = fillToSteadyState(params2);
  const ratio = v2.totalVolume / v1.totalVolume;
  assert(ratio > 1.9 && ratio < 2.1,
    `Doubling capacity should double V_eq; got ratio ${ratio.toFixed(3)}`);
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
