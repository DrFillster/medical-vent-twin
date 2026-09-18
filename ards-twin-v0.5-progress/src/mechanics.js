// mechanics.js — ThreeCompartmentMechanics implementing the DynamicMechanics
// interface from mechanics.spec.ts.
//
// v0.4.2: nonlinear finite-capacity exponential elastic law with implicit
// Newton-Raphson integration. Conservation is exact in the discrete update
// by construction (Q_i = (V_new - V_old) / dt, Q_central = Σ Q_i).
//
// Architecture:
//
//   Pvent --[Rcentral]-- Pbranch --[Ri, availability_i]--> x 3 compartments
//
// Per-compartment constitutive law (v0.4.2):
//
//   Vmax_i = availability_i * capacity_i
//   p_el_i = -K_i * ln(1 - V_i / Vmax_i)         for 0 ≤ V_i < Vmax_i
//   P_alv_i = AOP + p_el_i
//   G_i    = availability_i / R_i                branch conductance
//
// ODEs (continuous):
//
//   dV_i/dt = G_i * (Pbranch - P_alv_i)
//   Q_central = sum_i G_i * (Pbranch - P_alv_i)
//
// For FLOW boundary: Q_central = Q_requested (the boundary condition).
// For PRESSURE boundary: Pvent is imposed; Pbranch is implicit.
//
// Implicit-Euler residual (per active compartment):
//
//   F_i = V_i^{n+1} - V_i^n - dt * G_i * (Pbranch^{n+1} - AOP - p_el(V_i^{n+1})) = 0
//
// FLOW additional residual:
//   F_Q = sum_i (V_i^{n+1} - V_i^n) / dt - Q_req = 0
//
// PRESSURE additional residual (with Rc > 0):
//   F_C = (Pvent - Pbranch^{n+1}) / Rc - sum_i (V_i^{n+1} - V_i^n) / dt = 0
//
// Jacobian entries:
//
//   dF_i/dV_i = 1 + dt * G_i * dp_el/dV_i       (= 1 + dt * G_i / Ctan_i)
//   dF_i/dPbranch = -dt * G_i
//   dF_Q/dV_i = 1/dt
//   dC/dV_i = -1/dt    (PRESSURE only)
//   dC/dPbranch = -1/Rc   (PRESSURE only)
//
// This is a 4x4 dense system (3 active compartments + Pbranch).
//
// Conservation (exact by construction):
//
//   Q_i = (V_i_new - V_i_old) / dt
//   Q_central = sum_i Q_i
//   FLOW:    Q_central = Q_requested      to solver tolerance
//   PRESSURE: Pvent = Pbranch + Rc * Q_central   to solver tolerance
//
// Recruitment/mechanics coupling (predictor-corrector):
//   1. From state at t^n compute pdist_i^n, get r_i* (predictor).
//   2. Apply feasibility floor (no closing past V/(1-eps)/cap).
//   3. Solve implicit mechanics with r fixed.
//   4. Compute pdist_i^{n+1}, get r_i^{n+1} (corrector via trapezoidal avg).
//   5. Re-apply feasibility floor.
//   6. If |r_corrector - r_predictor| > r_tol, re-solve mechanics once.
//
// Limiting case Rcentral = 0:
//   Pbranch = Pvent exactly; solve each compartment independently.

const {
  availabilityFor,
  elasticPressure,
  elasticPressureAboveAOP,
  forwardElasticVolume,
  branchConductance,
  effectiveVolumeCapacity,
  dPressureDVolume,
  EPS_CAP,
} = require('./compartments.js');

const {
  recruitmentRate,
  minimumFeasibleRecruitment,
  distendingPressure,
  clamp,
} = require('./recruitment.js');

// Solver configuration.
const SOLVER_TOL_ABS = 1e-5;
const SOLVER_TOL_REL = 1e-8;
const SOLVER_MAX_ITER = 25;
const LINESEARCH_MAX = 25;
const DT_SUBDIV_LIMIT = 8;
const RECRUITMENT_TOL = 1e-6;

// v0.4.3: dimensionally scaled convergence.
//
// The raw residual mixes compartment volume equations (units: L) with
// the boundary equation (units: cmH2O). A Euclidean norm over mixed
// units is meaningless. We scale each component by a state-aware scale
// and use the infinity norm:
//
//   R̂_V_i = R_V_i / V_scale
//   R̂_P   = R_P   / P_scale
//   ‖R̂‖∞ = max(|R̂_V|, |R̂_P|)
//
// Convergence criterion: ‖R̂‖∞ < SOLVER_TOL_SCALED.
//
// V_scale must be tight enough to reject false fixed points. Using Vmax
// as V_scale gives a loose tolerance that allows implicit-Euler to
// "lock in" at any sub-equilibrium point. Using a smaller V_scale
// (e.g., max(V_scale, 0.01 L)) forces convergence toward the true
// step-to-step fixed point, not the false one.
const SOLVER_TOL_SCALED = 1e-3;
const V_SCALE_FLOOR = 0.01;   // characteristic V scale, never larger

// State-aware scales (per-step, recomputed from current state).
// V_scale is bounded by V_SCALE_FLOOR to ensure tight convergence.
function computeScales(activeComps, params, pBranchGuess) {
  let vmaxMin = Infinity;
  for (const { cp, cs } of activeComps) {
    const vmax = effectiveVolumeCapacity(cp, cs.recruitment);
    if (vmax > 0 && vmax < vmaxMin) vmaxMin = vmax;
  }
  if (!isFinite(vmaxMin)) vmaxMin = V_SCALE_FLOOR;
  // Use a tight V_scale: never larger than V_SCALE_FLOOR (0.01 L).
  // This makes the per-step residual tolerance a meaningful fraction of
  // a typical compartment's transient response.
  const V_scale = Math.min(vmaxMin, V_SCALE_FLOOR);
  // P_scale: order-of-magnitude of airway pressure. The boundary
  // residual has units cmH2O. Use max(|pBranch|, |AOP|, 1) as scale.
  const P_scale = Math.max(Math.abs(pBranchGuess),
                           Math.abs(params.airwayOpeningPressure),
                           1);
  return { V_scale, P_scale };
}

// v0.4.3 → v0.4.4: classify boundary feasibility with direction awareness.
//
// Given a failed Newton solve, determine whether the requested boundary
// is structurally infeasible (would require crossing finite-capacity
// domains or non-physical state) or whether the failure is a transient
// Newton nonconvergence that retry with smaller dt could fix.
//
// v0.4.4 direction-aware bounds:
//
//   Positive/inspiratory flow (Q_cmd > 0):
//     Q_cmd * dt <= sum_i(max(0, Vmax_i - V_i))
//     Use remaining available capacity.
//
//   Negative/expiratory flow (Q_cmd < 0):
//     |Q_cmd| * dt <= sum_i(max(0, V_i))
//     Use removable current gas volume (subject to lower-bound V >= 0).
//
// The constrained nonlinear solve remains authoritative; this is a
// necessary condition for fast-fail classification.
function classifyBoundaryFeasibility(activeComps, params, boundary, dt) {
  let capacityRemaining = 0;     // for inspiration: Vmax_i - V_i
  let removableVolume = 0;        // for expiration: V_i
  for (const { cp, cs } of activeComps) {
    const vmax = effectiveVolumeCapacity(cp, cs.recruitment);
    capacityRemaining += Math.max(0, (1 - EPS_CAP) * vmax - cs.volume);
    removableVolume += Math.max(0, cs.volume);
  }

  if (boundary.kind === 'FLOW') {
    const requestedDelta = boundary.flowLps * dt;
    if (requestedDelta >= 0) {
      // Inspiratory: positive flow into available capacity.
      if (requestedDelta > capacityRemaining + 1e-12) {
        return 'INFEASIBLE_BOUNDARY';
      }
    } else {
      // Expiratory: negative flow removes existing gas.
      const removalRequested = -requestedDelta;
      if (removalRequested > removableVolume + 1e-12) {
        return 'INFEASIBLE_BOUNDARY';
      }
    }
    return 'SOLVER_NONCONVERGENCE';
  }

  if (boundary.kind === 'PRESSURE') {
    // For PRESSURE boundary, the system may be infeasible if the
    // pressure is so high it would saturate all compartments in dt.
    // Without running the simulation, treat all pressure-boundary
    // failures as SOLVER_NONCONVERGENCE — the pressure boundary itself
    // is always feasible (just raises the question of how flow will
    // resolve internally).
    return 'SOLVER_NONCONVERGENCE';
  }
  return 'SOLVER_NONCONVERGENCE';
}

// Compute ‖R̂‖∞ given residual vector F and scales.
function scaledNorm(F, scales) {
  let maxR = 0;
  for (let i = 0; i < F.length - 1; i++) {
    const r = Math.abs(F[i]) / scales.V_scale;
    if (r > maxR) maxR = r;
  }
  // Last entry is the boundary (P) residual.
  const rP = Math.abs(F[F.length - 1]) / scales.P_scale;
  if (rP > maxR) maxR = rP;
  return maxR;
}

// --- Newton solver for one implicit step --------------------------------

// Solve a 4x4 dense linear system in-place: A * x = b.
// Returns null if A is singular.
function solve4x4(A, b) {
  const n = b.length;
  // Gaussian elimination with partial pivoting.
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let maxVal = Math.abs(M[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > maxVal) { maxVal = Math.abs(M[k][i]); maxRow = k; }
    }
    if (maxVal < 1e-30) return null;
    if (maxRow !== i) { const tmp = M[i]; M[i] = M[maxRow]; M[maxRow] = tmp; }
    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / M[i][i];
      for (let j = i; j < n + 1; j++) M[k][j] -= factor * M[i][j];
    }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j];
    x[i] = sum / M[i][i];
  }
  return x;
}

// Construct the residual F and Jacobian J for the implicit step.
// Unknowns: [V_0, V_1, V_2, Pbranch]  (only active compartments).
// `state` is a length-4 array (V_old for each active compartment + 0).
//   Actually we use the index of active compartments; let activeCount ≤ 3.
//   For simplicity: we always have exactly 3 unknowns for the volumes
//   (with placeholder compartments contributing trivially), and 1 for Pbranch.
//   Total 4x4.
function buildSystem(activeComps, vOld, pBranchGuess, boundary, params, dt) {
  // activeComps: [{cp, cs, G, idx}], where idx is the original compartment index.
  const N = activeComps.length;
  const dim = N + 1;  // +1 for Pbranch
  const F = new Array(dim).fill(0);
  const J = Array.from({ length: dim }, () => new Array(dim).fill(0));

  const aop = params.airwayOpeningPressure;
  let sumQ = 0;

  for (let i = 0; i < N; i++) {
    const { cp, cs, G } = activeComps[i];
    // Closed compartment: V fixed at 0.
    if (G === 0 || effectiveVolumeCapacity(cp, cs.recruitment) <= 0) {
      F[i] = 0;  // V_new is 0
      J[i][i] = 1;
      continue;
    }
    // If V is currently at zero (or below floating-point residual from a
    // previous deflation) AND the trial flow would be non-positive
    // (Pbranch ≤ AOP), the compartment cannot supply outflow from an empty
    // volume — force V_new = 0 with no flow contribution. Otherwise, treat
    // the compartment as fully dynamic.
    // Threshold is relative to Vmax: 1 ppm of capacity. Anything below that
    // is "effectively zero" for purposes of mechanical flow.
    const FLOW_ZERO_FRAC = 1e-6;
    const vmax = effectiveVolumeCapacity(cp, cs.recruitment);
    const FLOW_ZERO_TOL = vmax > 0 ? vmax * FLOW_ZERO_FRAC : 1e-9;
    const vNew = Math.max(0, Math.min(vOld[i], vmax * (1 - 2 * EPS_CAP)));
    // Strict inequality: only lock when Pbranch is unambiguously below AOP.
    // When Pbranch = AOP, the direction is indeterminate and we should let
    // Newton resolve it.
    const flowDir = G * (pBranchGuess - aop);
    // Saturation: V is at the capacity ceiling AND the trial flow wants to
    // push V higher. Lock at V=Vmax with no Q contribution.
    const satLimit = vmax > 0 ? vmax * (1 - EPS_CAP) : 0;
    if (vmax > 0 && vNew >= satLimit - 1e-15 && flowDir > 0) {
      F[i] = 0 - cs.volume;  // V stays at Vmax (clamped to vNew)
      J[i][i] = 1;
      J[i][N] = 0;
      continue;
    }
    if (vNew < FLOW_ZERO_TOL && flowDir < 0) {
      // Empty compartment, no driving inflow. Lock at V=0, no Q contribution.
      F[i] = 0 - cs.volume;
      J[i][i] = 1;
      J[i][N] = 0;
      continue;
    }
    // Evaluate the elastic law at the trial V.
    let pEl;
    if (vNew < FLOW_ZERO_TOL) {
      // V near zero but flow is incoming. Use a small regularizing V to
      // avoid singularity in p_el. The actual V_new is allowed to grow.
      const vTiny = 1e-12;
      pEl = elasticPressureAboveAOP(vTiny, cp, cs.recruitment);
    } else {
      pEl = elasticPressureAboveAOP(vNew, cp, cs.recruitment);
    }
    // v0.4.3: analytic tangent dP_el/dV = K/(Vmax - V).
    // (For V→0 with vTiny regularization, dPressureDVolume is well-defined
    // at the regularized point.)
    const vForTangent = vNew < FLOW_ZERO_TOL ? 1e-12 : vNew;
    const dpdV = dPressureDVolume(vForTangent, cp, cs.recruitment);
    F[i] = vNew - cs.volume - dt * G * (pBranchGuess - aop - pEl);
    J[i][i] = 1 + dt * G * dpdV;
    J[i][N] = -dt * G;
    sumQ += (vNew - cs.volume) / dt;
  }

  // Last row: boundary condition.
  if (boundary.kind === 'FLOW') {
    // F_Q = sum_i (V_new - V_old) / dt - Q_requested = 0
    F[N] = sumQ - boundary.flowLps;
    for (let i = 0; i < N; i++) J[N][i] = 1 / dt;
    J[N][N] = 0;
  } else {
    // PRESSURE boundary with Rc > 0: F_C = (Pvent - Pbranch)/Rc - sum_i ΔV/dt
    const Rc = params.centralAirwayResistance;
    if (Rc > 0) {
      F[N] = (boundary.pressureCmH2O - pBranchGuess) / Rc - sumQ;
      for (let i = 0; i < N; i++) J[N][i] = -1 / dt;
      J[N][N] = -1 / Rc;
    } else {
      // Rc = 0: Pbranch is fixed at Pvent; no C residual needed.
      F[N] = pBranchGuess - boundary.pressureCmH2O;
      J[N][N] = 1;
    }
  }

  return { F, J };
}

// Enforce volume feasibility: 0 ≤ V_i < (1 - EPS_CAP) * Vmax_i.
function feasibleV(v, cp, cs) {
  const vmax = effectiveVolumeCapacity(cp, cs.recruitment);
  if (vmax <= 0) {
    return 0;  // Closed compartment must have V = 0.
  }
  const limit = (1 - EPS_CAP) * vmax;
  if (v < 0) return 0;
  if (v > limit) return limit;
  return v;
}

// One Newton step with backtracking line search.
// `vTrial` and `pBranch` are arrays of trial values (mutated in place).
// Returns { converged, residual, iterations, scaledResidual,
//           lineSearchHalvings, activeSetTransitions }.
function newtonStep(activeComps, vTrial, pBranch, boundary, params, dt) {
  const N = activeComps.length;
  let iter;
  let lastResidualNorm = Infinity;
  let initialNorm = Infinity;
  let initialScaled = Infinity;
  let lastScaled = Infinity;
  let converged = false;
  let totalHalvings = 0;
  // v0.4.3: count active-set transitions (compartment crossing 0 or
  // (1 - EPS_CAP) * Vmax during this Newton call).
  let activeSetTransitions = 0;
  // Track each compartment's "regime" by whether its V is at the floor
  // (≤ floorTol * Vmax) or at the cap (≥ (1 - EPS_CAP) * Vmax).
  function regime(vNew, cp, cs) {
    const vmax = effectiveVolumeCapacity(cp, cs.recruitment);
    if (vmax <= 0) return 'CLOSED';
    const floorTol = 1e-6 * vmax;
    if (vNew <= floorTol) return 'FLOOR';
    const constLimit = (1 - EPS_CAP) * vmax;
    if (vNew >= constLimit - 1e-15) return 'CAP';
    return 'INTERIOR';
  }
  const initialRegimes = activeComps.map((ac, i) =>
    regime(vTrial[i], ac.cp, ac.cs));

  // v0.4.3: compute scales once at the start (state is approximately
  // fixed during Newton iteration; per-iter recomputation would just
  // jitter the convergence test).
  const scales = computeScales(activeComps, params, pBranch[0]);

  for (iter = 0; iter < SOLVER_MAX_ITER; iter++) {
    const { F, J } = buildSystem(
      activeComps, vTrial, pBranch[0], boundary, params, dt);

    // Raw Euclidean norm (kept for diagnostic, not used for convergence).
    let norm = 0;
    for (let i = 0; i < F.length; i++) norm += F[i] * F[i];
    norm = Math.sqrt(norm);
    if (iter === 0) initialNorm = norm;
    lastResidualNorm = norm;

    // v0.4.3: scaled infinity norm is the convergence criterion.
    const scaled = scaledNorm(F, scales);
    if (iter === 0) initialScaled = scaled;
    lastScaled = scaled;

    if (scaled < SOLVER_TOL_SCALED ||
        scaled < SOLVER_TOL_REL * Math.max(initialScaled, 1e-12)) {
      converged = true;
      break;
    }

    // Solve J * dx = -F.
    const b = F.map(x => -x);
    const dx = solve4x4(J, b);
    if (!dx) {
      return { converged: false, residual: norm,
               scaledResidual: scaled, iterations: iter, substeps: 0,
               lineSearchHalvings: totalHalvings,
               activeSetTransitions };
    }

    // Line search with backtracking on the volume feasibility.
    let stepScale = 1.0;
    let stepAccepted = false;
    let lineIter;
    for (lineIter = 0; lineIter < LINESEARCH_MAX; lineIter++) {
      const newVTrial = vTrial.map((v, i) => feasibleV(
        v + stepScale * dx[i], activeComps[i].cp, activeComps[i].cs));
      // Reject if a volume that was 0 (closed comp) tries to move away from 0.
      let trialOK = true;
      for (let i = 0; i < N; i++) {
        const { cp, cs, G } = activeComps[i];
        if (G === 0) continue;  // closed compartment stays at 0
        const vmax = effectiveVolumeCapacity(cp, cs.recruitment);
        if (vmax > 0) {
          const constLimit = (1 - EPS_CAP) * vmax;
          if (newVTrial[i] >= constLimit - 1e-15) { trialOK = false; break; }
        }
      }
      if (!trialOK) {
        stepScale *= 0.5;
        totalHalvings++;
        continue;
      }
      const newPBranch = pBranch[0] + stepScale * dx[N];
      // Re-evaluate residual at the trial. Use SCALED norm for step
      // acceptance (dimensionally consistent).
      let newScaled = 0;
      let sumQ = 0;
      const trialF = new Array(N + 1);
      for (let i = 0; i < N; i++) {
        const { cp, cs, G } = activeComps[i];
        if (G === 0) { trialF[i] = 0; continue; }
        const vmax = effectiveVolumeCapacity(cp, cs.recruitment);
        const floorFrac = 1e-6;
        const floorTol = vmax > 0 ? vmax * floorFrac : 1e-9;
        // Lock branch: empty + non-positive flow
        if (newVTrial[i] <= floorTol && (newPBranch - params.airwayOpeningPressure) <= 0) {
          trialF[i] = 0;
          continue;
        }
        const pEl = elasticPressureAboveAOP(newVTrial[i], cp, cs.recruitment);
        const r = newVTrial[i] - cs.volume
                  - dt * G * (newPBranch - params.airwayOpeningPressure - pEl);
        trialF[i] = r;
        sumQ += (newVTrial[i] - cs.volume) / dt;
      }
      // Boundary residual.
      let boundaryRes = 0;
      if (boundary.kind === 'FLOW') {
        boundaryRes = sumQ - boundary.flowLps;
      } else if (params.centralAirwayResistance > 0) {
        boundaryRes = (boundary.pressureCmH2O - newPBranch)
                      / params.centralAirwayResistance - sumQ;
      } else {
        boundaryRes = newPBranch - boundary.pressureCmH2O;
      }
      trialF[N] = boundaryRes;
      newScaled = scaledNorm(trialF, scales);

      if (newScaled < lastScaled) {
        // Accept step.
        // Count active-set transitions: any compartment that changed
        // regime (CLOSED/FLOOR/INTERIOR/CAP) since the start of Newton.
        const newRegimes = activeComps.map((ac, i) =>
          regime(newVTrial[i], ac.cp, ac.cs));
        for (let i = 0; i < N; i++) {
          if (newRegimes[i] !== initialRegimes[i]) {
            activeSetTransitions++;
            initialRegimes[i] = newRegimes[i];
          }
        }
        for (let i = 0; i < N; i++) vTrial[i] = newVTrial[i];
        pBranch[0] = newPBranch;
        stepAccepted = true;
        break;
      }
      stepScale *= 0.5;
      totalHalvings++;
    }
    if (!stepAccepted) {
      // Could not reduce residual; abort.
      return { converged: false, residual: norm,
               scaledResidual: lastScaled, iterations: iter, substeps: 0,
               lineSearchHalvings: totalHalvings,
               activeSetTransitions };
    }
  }
  return { converged, residual: lastResidualNorm,
           scaledResidual: lastScaled, iterations: iter, substeps: 0,
           lineSearchHalvings: totalHalvings,
           activeSetTransitions };
}

// --- Driver: implicit step with dt subdivision -------------------------

function solveImplicitStep(params, state, boundary, dt, recruitmentSnapshot) {
  // activeComps: compartments that can conduct (availability > 0).
  const activeComps = [];
  for (let i = 0; i < params.compartments.length; i++) {
    const cp = params.compartments[i];
    const cs = state.compartments[i];
    const csWithR = { ...cs, recruitment: recruitmentSnapshot[i] };
    const a = availabilityFor(cp, recruitmentSnapshot[i]);
    const G = branchConductance(cp, recruitmentSnapshot[i]);
    if (a > 0 && G > 0) {
      activeComps.push({ cp, cs: csWithR, G, idx: i });
    }
  }
  // If no active compartments, the result is trivial (zero volume change).
  if (activeComps.length === 0) {
    const zero = state.compartments.map(cs => ({
      ...cs,
      volume: 0,
      flow: 0,
      alveolarPressure: params.airwayOpeningPressure,
    }));
    const totalVolume = zero.reduce((s, c) => s + c.volume, 0);
    const pVent = boundary.kind === 'PRESSURE'
      ? boundary.pressureCmH2O
      : params.airwayOpeningPressure;
    return {
      state: { ...state, compartments: zero, totalVolume, totalFlow: 0 },
      output: {
        airwayPressure: pVent,
        branchPressure: pVent,
        airwayFlow: 0,
        centralFlow: 0,
        deliveredVolume: totalVolume,
        totalVolume,
        compartmentVolumes: zero.map(c => c.volume),
        compartmentFlows: zero.map(c => c.flow),
        compartmentPressures: zero.map(c => c.alveolarPressure),
        iterations: 0,
        residualNorm: 0,
        substeps: 1,
      },
    };
  }

  const N = activeComps.length;
  // Initialize trial volumes at current state; Pbranch at boundary value
  // (or AOP if FLOW with no flow).
  const vTrial = activeComps.map(({ cp, cs }) => feasibleV(cs.volume, cp, cs));
  const pBranch = [boundary.kind === 'PRESSURE'
    ? boundary.pressureCmH2O
    : params.airwayOpeningPressure];

  const r = newtonStep(activeComps, vTrial, pBranch, boundary, params, dt);
  if (r.converged) {
    return finalize(activeComps, vTrial, pBranch[0], state, boundary, params, dt,
                    r.iterations, r.residual, r.scaledResidual, 1,
                    r.lineSearchHalvings, r.activeSetTransitions);
  }
  // Newton failed: try with halved dt.
  if (dt / 2 < 1e-6) {
    // Last resort: distinguish INFEASIBLE_BOUNDARY from SOLVER_NONCONVERGENCE.
    //
    // v0.4.3 contract:
    //   - INFEASIBLE_BOUNDARY: the requested flow/pressure would require
    //     crossing the finite-capacity domain. The Newton solver failed
    //     because the problem has no feasible solution, not because of
    //     iteration issues.
    //   - SOLVER_NONCONVERGENCE: the Newton iteration ran out of steps
    //     or its line search failed to reduce the residual, but the
    //     problem may still be feasible.
    //
    // We probe feasibility: given the current state, can the requested
    // boundary be satisfied without crossing any Vmax? If yes, the
    // failure is a SOLVER_NONCONVERGENCE; if no, INFEASIBLE_BOUNDARY.
    const classification = classifyBoundaryFeasibility(
      activeComps, params, boundary, dt);
    return {
      state: {
        t: state.t,
        compartments: state.compartments.map((cs, i) => ({
          ...cs,
          id: cs.id || params.compartments[i].id,
        })),
        airwayPressure: pBranch[0],
        totalFlow: 0,
        totalVolume: state.totalVolume,
      },
      output: {
        airwayPressure: pBranch[0],
        branchPressure: pBranch[0],
        airwayFlow: 0,
        centralFlow: 0,
        deliveredVolume: 0,
        totalVolume: state.totalVolume,
        compartmentVolumes: state.compartments.map(c => c.volume),
        compartmentFlows: state.compartments.map(() => 0),
        compartmentPressures: state.compartments.map(c => c.alveolarPressure),
        iterations: 0,
        residualNorm: r.residual,
        scaledResidual: r.scaledResidual,
        substeps: DT_SUBDIV_LIMIT,
        solverFailure: true,
        failureKind: classification,
      },
    };
  }
  const half1 = solveImplicitStep(params, state, boundary, dt / 2, recruitmentSnapshot);
  // Compute recruitment at the half-step state.
  const newR = half1.state.compartments.map((cs, i) =>
    recruitmentSnapshot[i]);  // unchanged; we re-solve from the same snapshot
  const half2 = solveImplicitStep(params, half1.state, boundary, dt / 2, newR);
  half2.output.substeps = 2;
  return half2;
}

function finalize(activeComps, vTrial, pBranchSolved, state, boundary,
                 params, dt, iterations, residualNorm, scaledResidual,
                 substeps, lineSearchHalvings, activeSetTransitions) {
  // Build new state.
  const aop = params.airwayOpeningPressure;
  const nextComps = state.compartments.map((cs, i) => {
    const ac = activeComps.find(a => a.idx === i);
    if (!ac) {
      return { ...cs, volume: 0, flow: 0, alveolarPressure: aop };
    }
    const vNew = vTrial[activeComps.indexOf(ac)];
    const pAlv = elasticPressure(vNew, ac.cp, ac.cs.recruitment, aop);
    const q = (vNew - ac.cs.volume) / dt;
    return { ...cs, volume: vNew, flow: q, alveolarPressure: pAlv };
  });

  // Q_central = sum of Q_i (exact by construction).
  const compartmentFlows = nextComps.map(c => c.flow);
  const qCentral = compartmentFlows.reduce((s, q) => s + q, 0);

  // For FLOW: Pvent = Pbranch + Q_central * Rc.
  // For PRESSURE: Pvent is the imposed boundary value.
  const Rc = params.centralAirwayResistance;
  let pVent;
  if (boundary.kind === 'PRESSURE') {
    pVent = boundary.pressureCmH2O;
  } else {
    pVent = pBranchSolved + qCentral * Rc;
  }

  const totalVolume = nextComps.reduce((s, c) => s + c.volume, 0);

  return {
    state: {
      t: state.t + dt,
      compartments: nextComps,
      airwayPressure: pVent,
      totalFlow: qCentral,
      totalVolume,
    },
    output: {
      airwayPressure: pVent,
      branchPressure: pBranchSolved,
      airwayFlow: qCentral,
      centralFlow: qCentral,
      deliveredVolume: totalVolume,
      totalVolume,
      compartmentVolumes: nextComps.map(c => c.volume),
      compartmentFlows,
      compartmentPressures: nextComps.map(c => c.alveolarPressure),
      iterations,
      residualNorm,
      scaledResidual,
      substeps,
      // v0.4.3: per-step solver work counters for instrumentation.
      solverStats: {
        newtonIters: iterations,
        substeps,
        lineSearchHalvings,
        activeSetTransitions,
        residualNorm,
        scaledResidual,
        converged: iterations > 0 && iterations < SOLVER_MAX_ITER,
      },
    },
  };
}

// --- Mechanics step with predictor-corrector recruitment ---------------

class ThreeCompartmentMechanics {
  step(params, state, boundary, dt) {
    if (!(dt > 0)) throw new Error('dt must be > 0');
    if (boundary.kind !== 'FLOW' && boundary.kind !== 'PRESSURE') {
      throw new Error(`unknown boundary kind ${boundary.kind}`);
    }

    const aop = params.airwayOpeningPressure;
    const compartments = state.compartments;

    // 1. Predictor: compute recruitment update at t^n using P_alv^n.
    const rPredict = compartments.map((cs, i) => {
      const cp = params.compartments[i];
      const pAlv = cs.alveolarPressure || aop;
      const pdist = distendingPressure(pAlv, aop);
      let rCand = clamp(cs.recruitment + recruitmentRate(cs.recruitment, pdist, cp) * dt,
                        0, 1);
      // Apply feasibility floor.
      const rFloor = minimumFeasibleRecruitment(cs.volume, cp);
      rCand = Math.max(rCand, rFloor);
      return rCand;
    });

    // 2. Solve mechanics with rPredict.
    const sol1 = solveImplicitStep(params, state, boundary, dt, rPredict);

    // 3. Corrector: recompute recruitment at t^{n+1} using P_alv^{n+1}.
    const rCorrect = sol1.state.compartments.map((cs, i) => {
      const cp = params.compartments[i];
      const pAlv = cs.alveolarPressure || aop;
      const pdist = distendingPressure(pAlv, aop);
      // Trapezoidal: average the rates at t^n and t^{n+1}.
      const rateOld = recruitmentRate(
        compartments[i].recruitment,
        distendingPressure(compartments[i].alveolarPressure || aop, aop),
        cp);
      const rateNew = recruitmentRate(
        cs.recruitment,
        pdist,
        cp);
      const rMid = clamp(
        compartments[i].recruitment + 0.5 * (rateOld + rateNew) * dt,
        0, 1);
      // Apply feasibility floor.
      const rFloor = minimumFeasibleRecruitment(cs.volume, cp);
      return Math.max(rMid, rFloor);
    });

    // 4. If corrector moved materially, re-solve once.
    let final = sol1;
    for (let i = 0; i < compartments.length; i++) {
      if (Math.abs(rCorrect[i] - rPredict[i]) > RECRUITMENT_TOL) {
        const newState = {
          ...state,
          compartments: state.compartments.map((cs, idx) => ({
            ...cs,
            recruitment: rCorrect[idx],
          })),
        };
        final = solveImplicitStep(params, newState, boundary, dt, rCorrect);
        break;
      }
    }

    // 5. Stamp the corrector recruitment into final state for next step.
    final.state.compartments = final.state.compartments.map((cs, i) => ({
      ...cs,
      recruitment: rCorrect[i],
    }));

    return final;
  }
}

module.exports = {
  ThreeCompartmentMechanics,
  EPS_CAP,
  SOLVER_TOL_ABS,        // raw tolerance (diagnostic only)
  SOLVER_TOL_SCALED,     // v0.4.3: dimensionlessly scaled convergence criterion
  SOLVER_TOL_REL,
  SOLVER_MAX_ITER,
  RECRUITMENT_TOL,
  solve4x4,
  buildSystem,
  newtonStep,
  solveImplicitStep,
  // Backward-compat shim: legacy tests called `solveBranchForFlow`. The
  // v0.4.2 solver is implicit; this returns the per-step solve output.
  solveBranchForFlow(boundary, params, compartments) {
    const m = new ThreeCompartmentMechanics();
    const state = {
      t: 0,
      compartments: compartments.map((cs, i) => ({
        id: params.compartments[i].id,
        volume: cs.volume,
        flow: 0,
        alveolarPressure: 0,
        recruitment: cs.recruitment ?? 1,
      })),
      airwayPressure: 0,
      totalFlow: 0,
      totalVolume: compartments.reduce((s, c) => s + c.volume, 0),
    };
    const rPredict = state.compartments.map(c => c.recruitment);
    const sol = solveImplicitStep(params, state, boundary, 0.001, rPredict);
    return {
      pBranch: sol.output.branchPressure,
      pVent: sol.output.airwayPressure,
      delivered: sol.output.centralFlow,
      requested: boundary.kind === 'FLOW' ? boundary.flowLps : null,
    };
  },
};
