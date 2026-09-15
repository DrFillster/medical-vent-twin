// test/single_rc.test.js — Single-compartment analytic equilibrium tests
// against the v0.4.2 finite-capacity exponential elastic law.
//
// Analytic limit (PRESSURE boundary, Rcentral = 0, single active compartment):
//   V_eq = capacity × (1 − exp(−(Paw − AOP) / K))   when Paw > AOP, else 0
//   V(0) = 0
//   τ_local(V) = R × C × (1 − V/Vmax)               time constant decreases with V
//
// We test:
//   - Approach to equilibrium V_eq within tolerance.
//   - Low-resistance limit: V approaches V_eq quickly.
//   - Increasing resistance delays filling (qualitative, slower convergence).
//   - Doubling capacity doubles V_eq.

const { ThreeCompartmentMechanics } = require('../src/mechanics.js');
const { makePatientParams, makeBoundaryPressure,
         makeInitialState, makeBoundaryFlow } = require('../src/contracts.js');
const { forwardElasticVolume } = require('../src/compartments.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function makeRcParams({ R = 5, capacity = 1.0, elasticScale = 30.0 }) {
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

function runToSteadyState(params, boundaryFn, dt, maxSteps = 50000) {
  // Pressure-consistent init from AOP (zero volume).
  const state = makeInitialState(params, { initialPEEP: 0 });
  const m = new ThreeCompartmentMechanics();
  let s = state;
  for (let i = 0; i < maxSteps; i++) {
    s = m.step(params, s, boundaryFn(), dt).state;
  }
  return s;
}

// ---- T1: equilibrium matches forwardElasticVolume ----------------------
test('Single RC: equilibrium V_eq = forwardElasticVolume(Paw)', () => {
  const R = 5, capacity = 1.0, elasticScale = 30.0;
  const Paw = 12;
  const params = makePatientParams(makeRcParams({ R, capacity, elasticScale }));
  const s = runToSteadyState(params,
    () => makeBoundaryPressure({ pressureCmH2O: Paw, fio2: 0.5 }), 0.001);
  const Veq = forwardElasticVolume(Paw,
    params.compartments[0], 1.0, params.airwayOpeningPressure);
  const rel = Math.abs(s.totalVolume - Veq) / Veq;
  assert(rel < 0.02,
    `V_eq expected ${Veq.toFixed(4)}, got ${s.totalVolume.toFixed(4)} (rel ${rel.toFixed(3)})`);
});

// ---- T2: low resistance → V approaches V_eq quickly --------------------
test('Single RC: low resistance — V approaches V_eq within 2 s', () => {
  const R = 0.5, capacity = 1.0, elasticScale = 30.0;
  const Paw = 5;
  const params = makePatientParams(makeRcParams({ R, capacity, elasticScale }));
  const s = runToSteadyState(params,
    () => makeBoundaryPressure({ pressureCmH2O: Paw, fio2: 0.5 }), 0.001, 5000);
  const Veq = forwardElasticVolume(Paw,
    params.compartments[0], 1.0, params.airwayOpeningPressure);
  const rel = Math.abs(s.totalVolume - Veq) / Veq;
  assert(rel < 0.02,
    `V_∞ expected ${Veq.toFixed(4)}, got ${s.totalVolume.toFixed(4)} (rel ${rel.toFixed(3)})`);
});

// ---- T3: increasing resistance delays filling (qualitative) ------------
test('Single RC: higher resistance → slower mid-time filling', () => {
  const makeParams = (R) => makePatientParams(makeRcParams({ R, capacity: 1.0, elasticScale: 30.0 }));

  function fill(R, steps) {
    const params = makeParams(R);
    let s = makeInitialState(params, { initialPEEP: 0 });
    const m = new ThreeCompartmentMechanics();
    for (let i = 0; i < steps; i++) {
      s = m.step(params, s,
        makeBoundaryPressure({ pressureCmH2O: 10, fio2: 0.5 }), 0.001).state;
    }
    return s.totalVolume;
  }
  const vLo = fill(2, 1000);
  const vHi = fill(20, 1000);
  assert(vLo > vHi,
    `low-R should fill ahead of high-R: lo=${vLo.toFixed(3)}, hi=${vHi.toFixed(3)}`);
});

// ---- T4: doubling capacity doubles V_eq --------------------------------
test('Single RC: doubling capacity doubles V_eq', () => {
  const Paw = 10, elasticScale = 30.0;
  function VeqAt(capacity) {
    const params = makePatientParams(makeRcParams({ R: 5, capacity, elasticScale }));
    return runToSteadyState(params,
      () => makeBoundaryPressure({ pressureCmH2O: Paw, fio2: 0.5 }), 0.001).totalVolume;
  }
  const v1 = VeqAt(1.0);
  const v2 = VeqAt(2.0);
  const ratio = v2 / v1;
  assert(Math.abs(ratio - 2.0) < 0.02,
    `Doubling capacity should double V_eq: ratio=${ratio.toFixed(3)}`);
});

// ---- T5: AOP shift — V_eq depends on (Paw − AOP) -----------------------
test('Single RC: AOP shift — V_eq = forwardElasticVolume(Paw - AOP shift)', () => {
  const R = 5, capacity = 1.0, elasticScale = 30.0;
  const Paw = 12, AOP = 5;
  const params = makePatientParams({
    ...makeRcParams({ R, capacity, elasticScale }),
    airwayOpeningPressure: AOP,
  });
  const s = runToSteadyState(params,
    () => makeBoundaryPressure({ pressureCmH2O: Paw, fio2: 0.5 }), 0.001);
  const Veq = forwardElasticVolume(Paw,
    params.compartments[0], 1.0, AOP);
  const rel = Math.abs(s.totalVolume - Veq) / Veq;
  assert(rel < 0.02,
    `V_eq w/ AOP expected ${Veq.toFixed(4)}, got ${s.totalVolume.toFixed(4)}`);
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
