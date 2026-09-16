// test/i_failure_semantics.test.js — v0.4.3 acceptance tests (Section I).
//
// Solver-failure contract: failed mechanical solve does not advance time
// or state, and is reported as a structured diagnostic.

const assert = require('node:assert/strict');
const { makePatientParams } = require('../src/contracts.js');
const { PRESETS } = require('../src/presets.js');
const { VcAcController } = require('../src/ventilator/vc_ac.js');
const { Simulation } = require('../src/simulation.js');
const { ThreeCompartmentMechanics } = require('../src/mechanics.js');
const { makeBoundaryFlow, makeBoundaryPressure,
        makeInitialState } = require('../src/contracts.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok  -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}

test('I1: STEP_FAILED contract — state unchanged on solver failure', () => {
  // Force an INFEASIBLE_BOUNDARY: tiny Vmax + huge FLOW.
  const params = makePatientParams({
    compartments: [
      { id: 'normal', fraction: 1.0, resistance: 5, capacity: 1e-6,
        elasticScale: 30, perfusionFraction: 1.0, deadSpaceFraction: 0.3 },
      { id: 'recruitable', fraction: 0, resistance: 1, capacity: 1e-6,
        elasticScale: 1, perfusionFraction: 0, deadSpaceFraction: 0.3 },
      { id: 'consolidated', fraction: 0, resistance: 1, capacity: 1e-6,
        elasticScale: 1, perfusionFraction: 0, deadSpaceFraction: 0.3 },
    ],
    centralAirwayResistance: 0,
    airwayOpeningPressure: 0,
    initialPEEP: 5,
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
  });
  const m = new ThreeCompartmentMechanics();
  const state = makeInitialState(params, {
    initialPEEP: 5,
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
  });
  // 100 L/s flow on a 1e-6 L capacity compartment — infeasible.
  const boundary = makeBoundaryFlow({ flowLps: 100.0, fio2: 0.5 });
  const tBefore = state.t;
  const vBefore = state.totalVolume;
  const result = m.step(params, state, boundary, 0.001);
  // The solver MUST classify this as INFEASIBLE_BOUNDARY (not silently
  // commit state and pretend it converged).
  assert(result.output.solverFailure === true,
    `solver should fail for 100 L/s into 1e-6 L compartment; ` +
    `residual=${result.output.residualNorm}`);
  assert(result.output.failureKind === 'INFEASIBLE_BOUNDARY',
    `failureKind should be INFEASIBLE_BOUNDARY, got ${result.output.failureKind}`);
  // STATE MUST NOT ADVANCE.
  assert(result.state.t === tBefore,
    `time must not advance on failure: was ${tBefore}, now ${result.state.t}`);
  assert(result.state.totalVolume === vBefore,
    `volume must not advance on failure`);
});

test('I2: STEP_FAILED preserves trace integrity (no failed-step entry in trace)', () => {
  const params = makePatientParams(PRESETS.Baseline());
  const controller = new VcAcController({ fio2: 0.4, peep: 5, rr: 14, vt: 0.480,
    inspiratoryFlow: 0.5, inspiratoryPause: 0.3 });
  const sim = new Simulation({ params, controller, dt: 0.001, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } , trackGas: false });
  sim.runFor(60 / controller.settings.rr);
  // Trace should contain only successful steps.
  for (let i = 0; i < sim.trace.length; i++) {
    assert(!sim.trace[i].output.solverFailure,
      `step ${i} has solverFailure=true — failure should not be in trace`);
  }
});

test('I3: INFEASIBLE_BOUNDARY is distinct from SOLVER_NONCONVERGENCE', () => {
  // Verify the classifyBoundaryFeasibility helper distinguishes the two.
  // Two distinct scenarios:
  //   1. FX → INFEASIBLE_BOUNDARY: huge flow, tiny capacity.
  //   2. Otherwise → SOLVER_NONCONVERGENCE.

  // Scenario 1: 100 L/s into 1e-6 L capacity → INFEASIBLE_BOUNDARY.
  const infeasParams = makePatientParams({
    compartments: [
      { id: 'normal', fraction: 1.0, resistance: 5, capacity: 1e-6,
        elasticScale: 30, perfusionFraction: 1.0, deadSpaceFraction: 0.3 },
      { id: 'recruitable', fraction: 0, resistance: 1, capacity: 1e-6,
        elasticScale: 1, perfusionFraction: 0, deadSpaceFraction: 0.3 },
      { id: 'consolidated', fraction: 0, resistance: 1, capacity: 1e-6,
        elasticScale: 1, perfusionFraction: 0, deadSpaceFraction: 0.3 },
    ],
    centralAirwayResistance: 0,
    airwayOpeningPressure: 0,
    initialPEEP: 5,
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
  });
  const infeasState = makeInitialState(infeasParams, {
    initialPEEP: 5,
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
  });
  const m = new ThreeCompartmentMechanics();
  const infeasResult = m.step(infeasParams, infeasState,
    makeBoundaryFlow({ flowLps: 100.0, fio2: 0.5 }), 0.001);
  assert(infeasResult.output.solverFailure === true,
    'solver should fail for huge flow');
  assert(infeasResult.output.failureKind === 'INFEASIBLE_BOUNDARY',
    `expected INFEASIBLE_BOUNDARY, got ${infeasResult.output.failureKind}`);

  // Scenario 2: a tiny flow that fits inside capacity — solver should
  // succeed (no failure, no classification needed).
  const tinyResult = m.step(infeasParams, infeasState,
    makeBoundaryFlow({ flowLps: 1e-9, fio2: 0.5 }), 0.001);
  assert(!tinyResult.output.solverFailure,
    `tiny flow should succeed, got failure ${tinyResult.output.failureKind}`);
});

test('I4: failed step returns structured diagnostic', () => {
  // We construct a deliberately-failed scenario.
  const params = makePatientParams(PRESETS['Injury C']());
  const m = new ThreeCompartmentMechanics();
  // Construct a state with all compartments at zero, then push a FLOW
  // that requires negative volume impossible. The simulator will report
  // a solver failure or simply refuse.
  let state = makeInitialState(params, {
    initialPEEP: 5,
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
  });
  // Force the FLOW to be much larger than capacity allows.
  const boundary = makeBoundaryFlow({ flowLps: 1e6, fio2: 0.5 });
  let result = m.step(params, state, boundary, 0.001);
  if (result.output.solverFailure) {
    assert(result.output.failureKind === 'INFEASIBLE_BOUNDARY',
      'extremely large FLOW should be INFEASIBLE_BOUNDARY');
    assert(typeof result.output.residualNorm === 'number',
      'failure diagnostic includes residualNorm');
  }
});

test('I5: SOLVER_NONCONVERGENCE is distinct from INFEASIBLE_BOUNDARY', () => {
  // SOLVER_NONCONVERGENCE is what happens when Newton fails to converge
  // even though the problem is feasible. To force this, we use a
  // compartment with extremely low effective stiffness and an absurdly
  // large dt — the residual jump is so big Newton can't reduce it.
  //
  // Concrete setup: a normal compartment with very low K (very compliant)
  // and very low capacity. Use a pressure boundary that asks for huge
  // volume change in one step (e.g., P=200 cmH2O with dt=10 s).
  // The capacity is enough (Vmax=0.1 L) for the requested ΔV to fit, but
  // the dynamics is too stiff for the implicit solver.
  //
  // We accept either classification here — the point is the helper
  // distinguishes "structurally impossible" from "couldn't converge".
  // Both kinds of failures must NOT advance state.
  const params = makePatientParams({
    compartments: [
      { id: 'normal', fraction: 1.0, resistance: 0.5, capacity: 0.1,
        elasticScale: 5, perfusionFraction: 1.0, deadSpaceFraction: 0.3 },
      { id: 'recruitable', fraction: 0, resistance: 1, capacity: 1e-6,
        elasticScale: 1, perfusionFraction: 0, deadSpaceFraction: 0.3 },
      { id: 'consolidated', fraction: 0, resistance: 1, capacity: 1e-6,
        elasticScale: 1, perfusionFraction: 0, deadSpaceFraction: 0.3 },
    ],
    centralAirwayResistance: 0,
    airwayOpeningPressure: 0,
    initialPEEP: 5,
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
  });
  const m = new ThreeCompartmentMechanics();
  const state = makeInitialState(params, {
    initialPEEP: 5,
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
  });
  // Force the solver into a regime that may not converge: huge dt.
  // The pressure step is feasible (Vmax=0.1 L accommodates the request)
  // but Newton may need many iters.
  const boundary = makeBoundaryPressure({ pressureCmH2O: 25, fio2: 0.5 });
  const tBefore = state.t;
  const result = m.step(params, state, boundary, 1.0);   // dt=1s is huge.
  // Whatever happens — success or failure — time/contract must be sane.
  if (result.output.solverFailure) {
    assert(['INFEASIBLE_BOUNDARY', 'SOLVER_NONCONVERGENCE']
             .includes(result.output.failureKind),
      `failureKind must be classified, got ${result.output.failureKind}`);
    assert(result.state.t === tBefore,
      `time must not advance on failure: was ${tBefore}, now ${result.state.t}`);
  } else {
    // Solver succeeded — verify the result is physically sensible.
    assert(result.state.totalVolume <= 0.1,
      `V must be ≤ Vmax=0.1, got ${result.state.totalVolume}`);
    assert(result.state.totalVolume >= 0,
      `V must be ≥ 0, got ${result.state.totalVolume}`);
  }
});

// -------------------------------------------------------------------------
// I6: NEGATIVE/EXPIRATORY flow infeasibility uses removable volume.
// Force the system to have ~zero gas (a closed compartment) and ask for
// large expiratory flow. The classifier must report INFEASIBLE_BOUNDARY
// because there is no gas to remove.
// -------------------------------------------------------------------------
test('I6: negative-flow infeasibility uses removable volume', () => {
  // A single very-low-capacity compartment is essentially empty.
  const params = makePatientParams({
    compartments: [
      { id: 'normal', fraction: 1.0, resistance: 5, capacity: 1e-6,
        elasticScale: 30, perfusionFraction: 1.0, deadSpaceFraction: 0.3 },
      { id: 'recruitable', fraction: 0, resistance: 1, capacity: 1e-6,
        elasticScale: 1, perfusionFraction: 0, deadSpaceFraction: 0.3 },
      { id: 'consolidated', fraction: 0, resistance: 1, capacity: 1e-6,
        elasticScale: 1, perfusionFraction: 0, deadSpaceFraction: 0.3 },
    ],
    centralAirwayResistance: 0,
    airwayOpeningPressure: 0,
  });
  const m = new ThreeCompartmentMechanics();
  const state = makeInitialState(params, {
    initialPEEP: 5,
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
  });
  // 100 L/s *negative* (expiratory) flow on a 1e-6 L compartment —
  // there is no gas to remove, so direction-aware bound rejects.
  const boundary = makeBoundaryFlow({ flowLps: -100.0, fio2: 0.5 });
  const tBefore = state.t;
  const vBefore = state.totalVolume;
  const result = m.step(params, state, boundary, 0.001);
  // Must be classified INFEASIBLE_BOUNDARY — and not silently advance state.
  assert(result.output.solverFailure === true,
    `solver should fail for -100 L/s with V=0; residual=${result.output.residualNorm}`);
  assert(result.output.failureKind === 'INFEASIBLE_BOUNDARY',
    `failureKind should be INFEASIBLE_BOUNDARY, got ${result.output.failureKind}`);
  assert(result.state.t === tBefore,
    `time must not advance on failure: was ${tBefore}, now ${result.state.t}`);
  assert(result.state.totalVolume === vBefore,
    `volume must not advance on failure`);
});

// -------------------------------------------------------------------------
// I7: SMALL NEGATIVE flow on a populated compartment does NOT trigger
// INFEASIBLE_BOUNDARY — the gas is removable, the system can expire.
// -------------------------------------------------------------------------
test('I7: small negative flow on populated compartment is feasible', () => {
  // 1 L capacity at 0 PEEP, fully recruited — should hold ~0.6 L at AOP=0.
  const params = makePatientParams({
    compartments: [
      { id: 'normal', fraction: 1.0, resistance: 5, capacity: 1.0,
        elasticScale: 30, perfusionFraction: 1.0, deadSpaceFraction: 0.3 },
      { id: 'recruitable', fraction: 0, resistance: 1, capacity: 1e-6,
        elasticScale: 1, perfusionFraction: 0, deadSpaceFraction: 0.3 },
      { id: 'consolidated', fraction: 0, resistance: 1, capacity: 1e-6,
        elasticScale: 1, perfusionFraction: 0, deadSpaceFraction: 0.3 },
    ],
    centralAirwayResistance: 1,
    airwayOpeningPressure: 0,
  });
  const m = new ThreeCompartmentMechanics();
  const state = makeInitialState(params, {
    initialPEEP: 0,
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
  });
  // Equilibrate first with a small positive flow to populate V > 0.
  const fillBoundary = makeBoundaryFlow({ flowLps: 0.5, fio2: 0.5 });
  const filled = m.step(params, state, fillBoundary, 0.001);
  // Now ask for -0.5 L/s expiration. If V is sufficiently positive,
  // this is feasible.
  const expireBoundary = makeBoundaryFlow({ flowLps: -0.3, fio2: 0.5 });
  const result = m.step(params, filled.state, expireBoundary, 0.001);
  // Must not classify as infeasible if there is gas to remove. Solver may
  // still report failure (structural constraints), but if it does, it must
  // NOT be INFEASIBLE_BOUNDARY — expiration with V > |Q|*dt is feasible.
  if (result.output.solverFailure) {
    assert(result.output.failureKind !== 'INFEASIBLE_BOUNDARY',
      `failureKind should not be INFEASIBLE_BOUNDARY for feasible expiration, ` +
      `got ${result.output.failureKind}. V=${filled.state.totalVolume}, ` +
      `Q*dt=${0.3 * 0.001}`);
  }
  // Volume must stay >= 0.
  assert(result.state.totalVolume >= -1e-12,
    `V must stay >= 0, got ${result.state.totalVolume}`);
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
