// test/b_jacobian.test.js — v0.4.3 acceptance tests (Section B).
//
// Constitutive law and analytic Jacobian.

const assert = require('node:assert/strict');
const { forwardElasticVolume, dPressureDVolume } = require('../src/compartments.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok  -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}
function approx(a, b, tol) { return Math.abs(a - b) <= tol; }

const K = 30;
const capacity = 1.0;

test('B1: forward/inverse consistency', () => {
  // forwardElasticVolume(P, cp, a, AOP=0) -> V
  // inverse(forward(V)) = V via P = -K ln(1 - V/Vmax)
  const a = 1;
  for (const V of [0.05, 0.1, 0.3, 0.5, 0.8]) {
    const vmax = a * capacity;
    const P = -K * Math.log(1 - V / vmax);
    const V_recovered = forwardElasticVolume(P,
      { id: 'normal', capacity, elasticScale: K }, a, 0);
    assert(approx(V_recovered, V, 1e-10),
      `V=${V} -> P=${P.toFixed(4)} -> V_recovered=${V_recovered.toFixed(4)}`);
  }
});

test('B2: analytic derivative K/(Vmax - V) matches numerical', () => {
  const cp = { id: 'normal', capacity, elasticScale: K };
  for (const V of [0.05, 0.1, 0.3, 0.5, 0.8, 0.9]) {
    const analytic = dPressureDVolume(V, cp, 1);
    const epsV = 1e-7;
    const P_plus = -K * Math.log(1 - (V + epsV) / capacity);
    const P_minus = -K * Math.log(1 - (V - epsV) / capacity);
    const numerical = (P_plus - P_minus) / (2 * epsV);
    assert(approx(analytic, numerical, 1e-3),
      `V=${V}: analytic=${analytic.toFixed(4)}, numerical=${numerical.toFixed(4)}`);
  }
});

test('B3: tangent stiffness diverges as V → Vmax', () => {
  const cp = { id: 'normal', capacity, elasticScale: K };
  for (const V of [0.5, 0.9, 0.99, 0.999]) {
    const dPdV = dPressureDVolume(V, cp, 1);
    const expected = K / (capacity - V);
    assert(approx(dPdV, expected, 1e-3),
      `V=${V}: expected=${expected.toFixed(2)}, got=${dPdV.toFixed(2)}`);
    // Tangent stiffness grows monotonically as V approaches Vmax.
    // V=0.99 should be larger than V=0.9, etc.
    if (V >= 0.9) {
      assert(dPdV > 100,
        `V=${V}: tangent stiffness should be large near Vmax, got ${dPdV}`);
    }
  }
  // Monotonicity: dPdV strictly increases as V → Vmax.
  const vals = [0.5, 0.9, 0.99, 0.999].map(V => dPressureDVolume(V, cp, 1));
  for (let i = 1; i < vals.length; i++) {
    assert(vals[i] > vals[i - 1],
      `stiffness should increase with V: ${vals.join(', ')}`);
  }
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
