// test/a_initialization.test.js — v0.4.3 acceptance tests A1-A4.
//
// Acceptance gate (per ACCEPTANCE_TESTS_v0.4.3.md):
//   A1. Zero-availability compartment has V=0, G=0, Q=0, no NaN/Inf.
//   A2. PEEP > AOP single-compartment equilibrium matches forward elastic law.
//   A3. PEEP <= AOP lower-bound initialization produces V=0, no negative V.
//   A4. Preset ownership: missing initialRecruitmentState fails explicitly.

const assert = require('node:assert/strict');
const { makePatientParams, makeInitialState,
        makeCompartmentParams } = require('../src/contracts.js');
const { PRESETS } = require('../src/presets.js');
const { branchConductance, effectiveVolumeCapacity,
        forwardElasticVolume } = require('../src/compartments.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok  -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}
function approx(a, b, tol) { return Math.abs(a - b) <= tol; }

// -------------------------------------------------------------------------
// Helpers: build three-compartment PatientParams from a list of compartment
// descriptors. Each descriptor is { id, fraction, perfusion, capacity,
// elasticScale, resistance }. Fractions and perfusions must sum to 1.
// -------------------------------------------------------------------------
function buildParams(comps, aop = 0) {
  return makePatientParams({
    compartments: comps.map((c) => makeCompartmentParams({
      id: c.id,
      fraction: c.fraction,
      resistance: c.resistance ?? 0.5,
      capacity: c.capacity ?? 1.5,
      elasticScale: c.elasticScale ?? 30,
      perfusionFraction: c.perfusion ?? c.fraction,
      deadSpaceFraction: c.deadSpace ?? 0.3,
    })),
    centralAirwayResistance: 2.5,
    airwayOpeningPressure: aop,
  });
}

// Three-compartment normal/recruitable/consolidated default skeleton.
function skeleton(opts = {}) {
  return [
    { id: 'normal',        fraction: opts.fN ?? 0.5, capacity: opts.capN ?? 1.0,
      elasticScale: 30 },
    { id: 'recruitable',   fraction: opts.fR ?? 0.3, capacity: opts.capR ?? 1.5,
      elasticScale: 22 },
    { id: 'consolidated',  fraction: opts.fC ?? 0.2, capacity: 0.0,
      elasticScale: 35 },
  ];
}

// -------------------------------------------------------------------------
// A1: zero-availability compartment has V=0, G=0, Q=0, no NaN/Inf.
// -------------------------------------------------------------------------
test('A1: zero-availability compartment is closed', () => {
  // Build a params where one compartment (recruitable) has r=0 and
  // therefore Vmax=0, G=0. Other compartments are normal/consolidated.
  const params = buildParams([
    { id: 'normal',        fraction: 0.7, capacity: 1.0, elasticScale: 30 },
    { id: 'recruitable',   fraction: 0.2, capacity: 1.5, elasticScale: 22 },
    { id: 'consolidated',  fraction: 0.1, capacity: 0.0, elasticScale: 35 },
  ]);
  // r=0 for the recruitable compartment -> Vmax=0, G=0.
  const state = makeInitialState(params, {
    initialPEEP: 10,
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
  });
  // Recruitable must be exactly closed.
  const rc = state.compartments.find(c => c.id === 'recruitable');
  assert(Number.isFinite(rc.volume), `V must be finite, got ${rc.volume}`);
  assert(rc.volume === 0, `recruitable V must be 0 when r=0, got ${rc.volume}`);
  assert(rc.flow === 0, `recruitable Q must be 0, got ${rc.flow}`);
  const rcp = params.compartments.find(p => p.id === 'recruitable');
  const G = branchConductance(rcp, rc.recruitment);
  assert(G === 0, `recruitable conductance must be 0 when r=0, got ${G}`);
  // Consolidated is structurally closed (capacity=0).
  const cc = state.compartments.find(c => c.id === 'consolidated');
  assert(cc.volume === 0, `consolidated V must be 0, got ${cc.volume}`);
});

// -------------------------------------------------------------------------
// A2: PEEP > AOP single-compartment equilibrium matches forward elastic law.
// -------------------------------------------------------------------------
test('A2: PEEP > AOP equilibrium follows forward elastic law', () => {
  // Single open compartment: normal K=30 cmH2O, Vmax=1.0 L.
  // At PEEP=10 (above AOP=0): V_eq = 1.0 * (1 - exp(-10/30)).
  const params = buildParams([
    { id: 'normal', fraction: 1.0, capacity: 1.0, elasticScale: 30 },
    { id: 'recruitable', fraction: 0.0, capacity: 0.0, elasticScale: 22 },
    { id: 'consolidated', fraction: 0.0, capacity: 0.0, elasticScale: 35 },
  ]);

  const expected = forwardElasticVolume(10, params.compartments[0], 1, 0);

  const state = makeInitialState(params, {
    initialPEEP: 10,
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
  });
  const vInit = state.compartments[0].volume;
  assert(approx(vInit, expected, 1e-12),
    `normal V_eq at PEEP=10 expected ${expected}, got ${vInit}`);

  assert(approx(state.compartments[0].alveolarPressure, 10, 1e-12),
    `P_alv for open compartment at PEEP=10 must be 10, got ` +
    `${state.compartments[0].alveolarPressure}`);

  assert(state.compartments[0].flow === 0,
    `flow at equilibrium must be 0, got ${state.compartments[0].flow}`);
});

test('A2: equilibrium across multiple PEEP values', () => {
  const params = buildParams([
    { id: 'normal', fraction: 1.0, capacity: 1.5, elasticScale: 30 },
    { id: 'recruitable', fraction: 0.0, capacity: 0.0, elasticScale: 22 },
    { id: 'consolidated', fraction: 0.0, capacity: 0.0, elasticScale: 35 },
  ]);
  for (const peep of [5, 10, 15, 20]) {
    const state = makeInitialState(params, {
      initialPEEP: peep,
      initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
    });
    const expected = forwardElasticVolume(peep, params.compartments[0], 1, 0);
    assert(approx(state.compartments[0].volume, expected, 1e-12),
      `PEEP=${peep}: expected V=${expected}, got ${state.compartments[0].volume}`);
  }
});

// -------------------------------------------------------------------------
// A3: PEEP <= AOP lower-bound initialization produces V=0.
// -------------------------------------------------------------------------
test('A3: PEEP < AOP produces V=0 (lower-bound regime)', () => {
  const params = buildParams([
    { id: 'normal', fraction: 1.0, capacity: 1.5, elasticScale: 30 },
    { id: 'recruitable', fraction: 0.0, capacity: 0.0, elasticScale: 22 },
    { id: 'consolidated', fraction: 0.0, capacity: 0.0, elasticScale: 35 },
  ], 5);  // AOP = 5
  const state = makeInitialState(params, {
    initialPEEP: 3,  // PEEP < AOP
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
  });
  assert(state.compartments[0].volume === 0,
    `V must be 0 when PEEP < AOP, got ${state.compartments[0].volume}`);
  assert(state.compartments[0].alveolarPressure === 5,
    `P_alv must equal AOP, got ${state.compartments[0].alveolarPressure}`);
});

test('A3: PEEP == AOP produces V=0 (boundary of lower-bound regime)', () => {
  const params = buildParams([
    { id: 'normal', fraction: 1.0, capacity: 1.5, elasticScale: 30 },
    { id: 'recruitable', fraction: 0.0, capacity: 0.0, elasticScale: 22 },
    { id: 'consolidated', fraction: 0.0, capacity: 0.0, elasticScale: 35 },
  ], 5);  // AOP = 5
  const state = makeInitialState(params, {
    initialPEEP: 5,  // PEEP == AOP
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
  });
  assert(state.compartments[0].volume === 0,
    `V must be 0 when PEEP == AOP, got ${state.compartments[0].volume}`);
  assert(state.compartments[0].alveolarPressure === 5,
    `P_alv must equal AOP, got ${state.compartments[0].alveolarPressure}`);
});

// -------------------------------------------------------------------------
// A4: Preset ownership. Missing initialRecruitmentState must fail explicitly.
// -------------------------------------------------------------------------
test('A4: missing initialPEEP fails explicitly', () => {
  const params = buildParams([
    { id: 'normal', fraction: 1.0, capacity: 1.0, elasticScale: 30 },
    { id: 'recruitable', fraction: 0.0, capacity: 0.0, elasticScale: 22 },
    { id: 'consolidated', fraction: 0.0, capacity: 0.0, elasticScale: 35 },
  ]);
  delete params.initialPEEP;
  let threw = false, msg = '';
  try {
    makeInitialState(params);
  } catch (e) {
    threw = true; msg = e.message;
  }
  assert(threw, 'makeInitialState must throw when initialPEEP is missing');
  assert(msg.includes('initialPEEP'),
    `error message should mention initialPEEP, got: ${msg}`);
});

test('A4: missing initialRecruitmentState defaults to closed (no guess)', () => {
  const params = makePatientParams(PRESETS.Baseline());
  delete params.initialRecruitmentState;
  const state = makeInitialState(params, { initialPEEP: 5 });
  // The closed default is the explicit absence of recruitment, not a guess.
  assert(state.compartments.find(c => c.id === 'normal').recruitment === 1,
    'normal must default to 1');
  assert(state.compartments.find(c => c.id === 'recruitable').recruitment === 0,
    'recruitable must default to 0 (closed)');
  assert(state.compartments.find(c => c.id === 'consolidated').recruitment === 0,
    'consolidated must default to 0');
});

test('A4: invalid recruitment value is rejected', () => {
  const params = buildParams([
    { id: 'normal', fraction: 1.0, capacity: 1.0, elasticScale: 30 },
    { id: 'recruitable', fraction: 0.0, capacity: 0.0, elasticScale: 22 },
    { id: 'consolidated', fraction: 0.0, capacity: 0.0, elasticScale: 35 },
  ]);
  let threw = false;
  try {
    makeInitialState(params, {
      initialPEEP: 10,
      initialRecruitmentState: { normal: 'high', recruitable: 0, consolidated: 0 },
    });
  } catch (e) { threw = true; }
  assert(threw, 'non-numeric recruitment must be rejected');
});

// -------------------------------------------------------------------------
// Composite: invariants across all presets.
// -------------------------------------------------------------------------
test('Composite: every preset initializes within finite-capacity domain', () => {
  for (const name of Object.keys(PRESETS)) {
    const params = makePatientParams(PRESETS[name]());
    const state = makeInitialState(params);
    for (const c of state.compartments) {
      const cp = params.compartments.find(p => p.id === c.id);
      const vmax = effectiveVolumeCapacity(cp, c.recruitment);
      assert(c.volume >= 0,
        `${name}/${c.id}: V must be >= 0, got ${c.volume}`);
      assert(c.volume <= vmax + 1e-15,
        `${name}/${c.id}: V=${c.volume} exceeds Vmax=${vmax}`);
      assert(Number.isFinite(c.volume),
        `${name}/${c.id}: V must be finite`);
      assert(Number.isFinite(c.flow),
        `${name}/${c.id}: Q must be finite`);
      assert(Number.isFinite(c.alveolarPressure),
        `${name}/${c.id}: P_alv must be finite`);
      assert(c.recruitment >= 0 && c.recruitment <= 1,
        `${name}/${c.id}: r must be in [0,1]`);
    }
  }
});

test('Composite: initial airwayPressure equals preset PEEP', () => {
  for (const name of Object.keys(PRESETS)) {
    const params = makePatientParams(PRESETS[name]());
    const state = makeInitialState(params);
    assert(state.airwayPressure === params.initialPEEP,
      `${name}: airwayPressure ${state.airwayPressure} != ` +
      `preset PEEP ${params.initialPEEP}`);
  }
});

test('Composite: totalFlow = 0 at init', () => {
  for (const name of Object.keys(PRESETS)) {
    const params = makePatientParams(PRESETS[name]());
    const state = makeInitialState(params);
    assert(state.totalFlow === 0,
      `${name}: initial totalFlow must be 0`);
  }
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
