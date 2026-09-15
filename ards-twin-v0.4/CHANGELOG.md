# ARDS Digital Twin — Changelog

## v0.4.3 (2026-09-15) — Numerical rigor rewrite

### Breaking changes from v0.4.2
- `makeInitialState(params, options)`: now requires `initialPEEP` AND
  `initialRecruitmentState` in `options` or on `params`. The legacy
  `initialVolume` path is removed. Presets own their initial state.
- `Simulation({ params, controller, ... })`: pulls `initialPEEP` and
  `initialRecruitmentState` from `params` (the preset). Will throw if
  neither preset nor controller can supply them.
- Conservation/initialization legacy test that asserted `airwayPressure === 0`
  now asserts the preset's `initialPEEP`.

### New contracts
- **STEP_FAILED**: solver failure does not advance time or state.
  Returned as `{ failed: true, output: { ..., solverFailure, failureKind } }`.
- **INFEASIBLE_BOUNDARY vs SOLVER_NONCONVERGENCE**: distinct diagnostic
  classifications for boundary infeasibility vs Newton nonconvergence.
- **Dimensionlessly scaled convergence**: `‖R̂‖∞ < 1e-3` is the
  convergence criterion (was: raw Euclidean norm < 1e-5).
- **Analytic Jacobian**: `dP/dV = K/(Vmax - V)` replaces finite-difference
  in production mechanics.
- **Derecruitment projection**: `stepRecruitmentWithFloor` clamps
  `r >= V / ((1 - 1e-6) * capacity)` to preserve V ≤ Vmax(r).

### Acceptance suite (123 tests, 89 baseline + 34 new)
- **A**: 11 — Initialization, lower-bound regime, preset ownership
- **B**: 3 — Jacobian (analytic vs numerical)
- **C**: 1 — Small-signal τ ≈ R·C_tan
- **D**: 8 — Flow conservation, central resistance, plateau
- **E**: 2 — Low-resistance convergence across decades
- **F**: 4 — Recruitment mechanics + derecruitment projection
- **G**: 5 — Multi-breath VC + PC, all injury severities, zero failures
- **H**: 3 — dt convergence at 2/1/0.5 ms
- **I**: 4 — Failure semantics, INFEASIBLE_BOUNDARY classification
- **J**: 3 — Instrumentation, machine-readable diagnostics

### Known pathology (NOT a correctness bug, flagged for future work)
- Injury C PEEP=5 dt=1ms: 32% of steps subdivide (substeps=2).
  Wall-clock: 2023 ms for 10 s simulated (≈200× real-time).
  Newton itself converges in 0.6 iters avg — the bottleneck is
  dt-subdivision near the closure boundary of recruitable compartments.
- See `PERFORMANCE_BENCH.json` and `REVIEW_NOTES.md` for details and
  proposed fixes.

## v0.4.2 (2026-09-15) — Nonlinear mechanics + Newton-Raphson + recruitment floor
- Finite-capacity exponential elastic law
- Implicit Newton-Raphson mechanics solver
- Bounded recruitment kinetics with feasibility floor
- 89/89 tests passing

## v0.4.1 (earlier) — Central R + AOP fix + gas-toggle test + plateau
## v0.4.0 — Initial multi-compartment mechanics
