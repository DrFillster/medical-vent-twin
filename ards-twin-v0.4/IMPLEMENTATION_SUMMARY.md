# ARDS Digital Twin v0.4.3 — Implementation Summary

## What this release is

A numerical-rigor rewrite of v0.4.2. The mechanics foundation (finite-capacity
exponential elastic law, implicit Newton-Raphson solver, availability-scaled
branch conductance, FLOW/PRESSURE boundary contract) is preserved. What
changes is the **initialization, convergence, and failure-handling contract**.

## Phase-by-phase implementation

### Phase 1 — Initialization (Section A)
Files: `src/presets.js`, `src/contracts.js`, `src/simulation.js`,
`test/a_initialization.test.js`.

Each preset now declares:
- `initialPEEP` (cmH2O) — the equilibrium target
- `initialRecruitmentState` — explicit per-compartment availability

The initializer `makeInitialState(params, options)` then produces
pressure-consistent initial state in three regimes:
- Closed (`Vmax = 0`): V = 0, P_alv = AOP, G = 0
- Elastic (`Vmax > 0, PEEP > AOP`): V from forward elastic law, P_alv = PEEP
- Lower-bound (`Vmax > 0, PEEP ≤ AOP`): V = 0, P_alv = AOP

`Simulation` extracts `initialPEEP` and `initialRecruitmentState` from
the preset; the controller's settings are a fallback, never an invention.

11 tests cover zero-availability closure, PEEP > AOP equilibrium,
PEEP ≤ AOP lower-bound, preset ownership, and composite invariants.

### Phase 2 — Analytic Jacobian + scaled convergence (Section B)
Files: `src/mechanics.js`, `test/b_jacobian.test.js`.

Replaced the finite-difference Jacobian with the analytic derivative
`K/(Vmax - V)`. Replaced the raw Euclidean norm with a dimensionlessly
scaled infinity norm: `‖R̂‖∞ < 1e-3`.

The V_scale floor (0.01 L) is critical — using Vmax as V_scale allows
the implicit Euler update to lock in at sub-equilibrium points. With
the tight floor, the per-step residual tolerance is a meaningful
fraction of a typical transient response.

3 tests verify B1 (forward/inverse identity), B2 (analytic vs numerical
derivative), B3 (stiffness divergence near Vmax).

### Phase 3 — Failure semantics (Section I)
Files: `src/mechanics.js`, `src/simulation.js`,
`test/i_failure_semantics.test.js`.

`Simulation.step()` now gates state commit on `output.solverFailure`.
A failed step returns `{ failed: true, output: { ..., solverFailure,
failureKind } }` without advancing time or updating gas/metrics.

Two distinct failure classifications in `classifyBoundaryFeasibility`:
- `INFEASIBLE_BOUNDARY`: requested Q·dt > Σ capacity remaining
- `SOLVER_NONCONVERGENCE`: Newton ran out of steps or line search failed

4 tests verify the contract.

### Phase 4 — Derecruitment projection (Section F)
Files: `src/recruitment.js`, `test/f_recruitment.test.js`.

`stepRecruitmentWithFloor` implements the projection rule:
`r ≥ V / ((1 - EPS_PROJ) * capacity)` with `EPS_PROJ = 1e-6`.

The invariant `V ≤ Vmax(r)` holds at all times. Closed-compartment
`r = 0` ⇒ Vmax = 0, G = 0 invariants are preserved. 4 tests cover
this section.

### Phase 5 — Instrumentation (Section J)
Files: `src/mechanics.js`, `test/j_instrumentation.test.js`.

Per-step solver work counters in `output.solverStats`:
- `newtonIters`, `substeps`, `lineSearchHalvings`
- `residualNorm`, `scaledResidual`, `converged`

3 tests verify machine-readable diagnostics across all injury severities.
The injury C PEEP=5 pathology is quantified: 32% of steps subdivide,
Newton itself converges in 0.6 iters avg.

### Phase 6 — Acceptance tests (Sections C, D, E, G, H)
Files: `test/c_small_signal.test.js`, `test/f_recruitment.test.js`,
`test/g_multi_breath.test.js`, `test/h_dt_convergence.test.js`.

- C: small-signal τ ≈ R·C_tan (1 test)
- D: flow conservation, central resistance, plateau invariance (8 tests
  in `conservation.test.js`)
- E: low-R convergence across decades (2 tests in `d_low_resistance.test.js`)
- G: multi-breath VC + PC, all injury severities (5 tests)
- H: dt convergence at 2/1/0.5 ms (3 tests)

### Phase 7 — Performance tuning
**NOT performed in v0.4.3.** Per the reviewer's directive:
"Instrument before optimizing." The instrumentation in Phase 5 quantifies
the pathology; the fix (active-set/boundary formulation) is left for
a future release.

### Phase 8 — Artifacts and return package
- `TEST_RESULTS.json` — pass/fail per suite, acceptance gate summary
- `NUMERICAL_DIAGNOSTICS.json` — solver failures, conservation residuals,
  capacity-domain violations, low-R convergence, dt convergence,
  tolerance regime, Jacobian type, recruitment projection rule,
  presets
- `PERFORMANCE_BENCH.json` — wall-clock + solver work counters per scenario

## Test results

```
TOTAL: 123 passed, 0 failed
- 89 baseline tests (preserved from v0.4.2)
- 34 new v0.4.3 acceptance tests
```

## Honest engineering notes

### Bug found and fixed during development
The v0.4.2 mechanics used `V_scale = Vmax`, which allowed the implicit
Euler update to converge to a false fixed point at V = 0.21 instead of
the true equilibrium V = 0.33 (when `PEEP=12, K=30, capacity=1.0, R=5`).
The fix was a tight V_scale floor of 0.01 L. The bug was caught by the
`p0_single_compartment.test.js` regression test suite.

### Known issue: low-PEEP Injury C perf pathology
At Injury C PEEP=5 dt=1ms, 32% of steps subdivide. This is NOT a
correctness bug — zero solver failures, zero capacity violations,
zero NaN/Inf. The simulator produces correct answers slowly. The
reviewer's directive ("instrument before optimizing") is honored; the
fix is left for v0.5.

### Scope discipline
The reviewer explicitly forbade:
- PSV, spontaneous effort, dyssynchrony, hemodynamics
- Patient-specific clinical calibration
- New ARDS phenotype claims
- Major UI work

None of these were added. The simulator remains a controlled mechanical
ventilation model.
