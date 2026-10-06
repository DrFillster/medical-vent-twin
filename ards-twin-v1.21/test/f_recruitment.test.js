// test/f_recruitment.test.js — v0.4.3 acceptance tests (Section F).
//
// Recruitment mechanics + derecruitment projection rule + trapped gas.

const assert = require('node:assert/strict');
const { makePatientParams, makeInitialState,
        makeCompartmentParams } = require('../src/contracts.js');
const { stepRecruitmentWithFloor, minimumFeasibleRecruitment,
        distendingPressure } = require('../src/recruitment.js');
const { ThreeCompartmentMechanics } = require('../src/mechanics.js');
const { makeBoundaryPressure } = require('../src/contracts.js');
const { effectiveVolumeCapacity } = require('../src/compartments.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok  -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}

function approx(a, b, tol) { return Math.abs(a - b) <= tol; }

function mkRecruitable(capacity, elasticScale = 22) {
  return makeCompartmentParams({
    id: 'recruitable', fraction: 0.5, resistance: 0.5,
    capacity, elasticScale, perfusionFraction: 0.4, deadSpaceFraction: 0.4,
  });
}

test('F1: r=0 → Vmax=0, G=0, V=0', () => {
  const cp = mkRecruitable(1.0);
  const vmax = effectiveVolumeCapacity(cp, 0);
  assert(vmax === 0, `Vmax at r=0 must be 0, got ${vmax}`);
  // G = branchConductance would be 0.
  const { branchConductance } = require('../src/compartments.js');
  assert(branchConductance(cp, 0) === 0, 'G=0 at r=0');
});

test('F2: increasing r increases available capacity', () => {
  const cp = mkRecruitable(2.0);
  const vals = [0, 0.25, 0.5, 0.75, 1.0].map(r => effectiveVolumeCapacity(cp, r));
  // Monotonic: each strictly greater than the previous.
  for (let i = 1; i < vals.length; i++) {
    assert(vals[i] > vals[i - 1],
      `Vmax should grow with r: Vmax[${i}]=${vals[i]} vs Vmax[${i-1}]=${vals[i-1]}`);
  }
});

test('F3: derecruitment cannot make V >= Vmax(r)', () => {
  // Set up a recruitable compartment with V=0.8 L and r=0.5 (Vmax=1.0).
  // Try to close r to 0.7 — Vmax(0.7) = 1.4. V < Vmax. OK.
  // Try to close r to 0.3 — Vmax(0.3) = 0.6. V > Vmax! Trapped gas.
  // Projection: r_new stays at the largest feasible r with margin.
  const cp = mkRecruitable(2.0);
  const V = 0.8;
  const r_old = 0.5;
  // P_alv is below P_close (P_close = 10 cmH2O); strong closing tendency.
  const P_alv = 0;  // AOP=0, dist=0 < P_close
  const dt = 1.0;   // big dt to ensure closing happens
  const r_new = stepRecruitmentWithFloor(r_old, P_alv, dt, V, cp, 0);
  const rFloor = minimumFeasibleRecruitment(V, cp);
  assert(r_new >= rFloor,
    `r_new=${r_new} must be >= rFloor=${rFloor} to avoid V >= Vmax(r)`);
  // Verify the invariant: V <= Vmax(r_new)
  const vmaxNew = effectiveVolumeCapacity(cp, r_new);
  assert(V <= vmaxNew,
    `V=${V} must be <= Vmax(r_new)=${vmaxNew} — trapped gas preserved`);
});

test('F3b: trapped gas rule — V is preserved through attempted closure', () => {
  const cp = mkRecruitable(1.5);
  const V = 0.5;
  const r_old = 1.0;
  const dt = 10.0;
  // Strong closing force.
  for (let i = 0; i < 100; i++) {
    const r_new = stepRecruitmentWithFloor(r_old, 0, dt, V, cp, 0);
    const vmaxNew = effectiveVolumeCapacity(cp, r_new);
    assert(V <= vmaxNew + 1e-9,
      `step ${i}: V=${V} must be <= Vmax(r_new=${r_new})=${vmaxNew}`);
    // r cannot drop below the feasibility floor.
    const rFloor = minimumFeasibleRecruitment(V, cp);
    assert(r_new >= rFloor - 1e-9,
      `step ${i}: r=${r_new} must be >= floor=${rFloor}`);
  }
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
