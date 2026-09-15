# ARDS Digital Twin v0.4.3 — Review Notes

## Scope

This release is a numerical-rigor rewrite. **No new physiology.**
Specifically NOT added (per acceptance contract):
- No PSV (Pressure Support Ventilation)
- No spontaneous respiratory effort
- No dyssynchrony models
- No hemodynamic coupling
- No patient-specific clinical calibration
- No new ARDS phenotype claims
- No major UI work

## What changed and why

### 1. Pressure-consistent initialization (Section A)
v0.4.2 used `initialVolume: 0.05` as a legacy default. This:
- Bypassed the pressure-consistent forward elastic law
- Did not honor the `PEEP ≤ AOP` lower-bound regime
- Silently assigned positive volume to compartments with `Vmax = 0`
  (the `vmax > 0 && v >= vmax` validator missed the `vmax ≤ 0 && v > 0` case)

v0.4.3 requires presets to own `initialPEEP` and `initialRecruitmentState`.
The initializer never invents a recruitment fraction. Three regimes:
- `Vmax = 0` (closed)        → V = 0, P_alv = AOP
- `Vmax > 0, PEEP > AOP`     → V from forward elastic law, P_alv = PEEP
- `Vmax > 0, PEEP ≤ AOP`     → V = 0 (lower-bound), P_alv = AOP

### 2. Analytic Jacobian (Section B)
v0.4.2 used finite-difference: `dpdV = (pEl(V+ε) - pEl(V)) / ε`.
v0.4.3 uses the exact derivative `K/(Vmax - V)`, exposed via
`dPressureDVolume(V, cp, recruitment)` in `compartments.js`.

### 3. Dimensionlessly scaled convergence (Sections B + H)
v0.4.2 used a raw Euclidean norm over mixed physical units:
`norm = sqrt(Σ F_i²)`. This is dimensionally meaningless (mixes L with
cmH2O). v0.4.3 uses:
- `V_scale = min(vmaxMin, 0.01 L)` (tight floor)
- `P_scale = max(|pBranch|, |AOP|, 1)`
- `R̂_V = F_V / V_scale`, `R̂_P = F_P / P_scale`
- `‖R̂‖∞ < 1e-3` is the convergence criterion

The 0.01 L V_scale floor is critical. With V_scale = Vmax, the implicit
Euler update can "lock in" at any sub-equilibrium point where the
per-step residual happens to be ≤ 1e-3. The tighter floor forces
convergence toward the true step-to-step fixed point.

### 4. STEP_FAILED contract (Section I)
v0.4.2 returned best-effort state with `solverFailure: true` AND
committed the state and advanced time. This is now explicitly forbidden:
```
STEP_FAILED
  state not advanced
  time not advanced
  diagnostics returned
```
The caller may retry with smaller dt, abort the breath, or terminate
the simulation. The Simulation layer gates state commit on
`output.solverFailure`.

### 5. INFEASIBLE_BOUNDARY vs SOLVER_NONCONVERGENCE (Section I)
Two distinct failure modes:
- `INFEASIBLE_BOUNDARY`: the requested flow/pressure would require
  crossing the finite-capacity domain. Detected by checking
  `Q_requested * dt > Σ (Vmax_i - V_i)` (capacity remaining).
- `SOLVER_NONCONVERGENCE`: Newton iteration ran out of steps or
  line search failed to reduce residual; the problem may still be
  feasible (retry with smaller dt could fix it).

### 6. Derecruitment projection rule (Section F)
v0.4.2 closed the compartment below the feasibility floor via clamp.
v0.4.3 documents the rule explicitly and adds a margin:
- Compute `r_proposed = stepRecruitment(r_old, ...)`
- If `r_proposed < r_floor`, project:
  - `r_final = max(r_proposed, V / ((1 - EPS_PROJ) * capacity))`
  - `EPS_PROJ = 1e-6`
- Invariant: `V ≤ Vmax(r)` at all times

## Performance — known pathology (NOT a correctness bug)

**Injury C PEEP=5 dt=1ms**: 32% of mechanics steps subdivide (substeps=2).
Newton itself converges in 0.6 iters avg. The bottleneck is dt-subdivision
near the closure boundary of recruitable compartments.

Wall-clock: 2023 ms for 10 s simulated time (≈ 200× real-time).

**This is NOT a correctness bug**: zero solver failures, zero capacity
violations, zero NaN/Inf. The simulation produces correct answers
slowly. v0.4.3 is the numerical-rigor release, not the perf release.

### Proposed fixes (for v0.5 or later)

Per the reviewer's directive: **"instrument before optimizing"**. The
J-test quantifies solver work per scenario. Future work:

1. **Active-set / boundary formulation in Newton.** When a compartment
   is at the closure boundary, the unknown V becomes a known (= 0 or
   Vmax), and the residual simplifies. This is the principled fix.
2. **Skip Newton when all compartments are trivially closed.** If
   V_i = 0 and flow is non-positive, the solution is V_new = V_old = 0.
3. **Cache Jacobian when regime unchanged.** When no compartment
   transitions across a regime boundary between iterations, the
   Jacobian from the previous step is exact.
4. **Regime-adaptive dt.** Use larger dt in near-closed regimes where
   the system is barely evolving. This is the band-aid fix and is
   NOT recommended.

Wall-clock time is a benchmark, not a correctness gate, per the
reviewer's directive.

## Test coverage

123 tests across 21 test files. Run `node test/*.js` (or each individually)
to verify. New acceptance tests are in `test/[a-j]_*.test.js`.

## Files added/modified

- `src/presets.js` — presets own initialPEEP, initialRecruitmentState
- `src/contracts.js` — makeInitialState v0.4.3 contract; presets validated
- `src/mechanics.js` — analytic Jacobian, scaled convergence,
  STEP_FAILED contract, INFEASIBLE_BOUNDARY classification,
  per-step instrumentation
- `src/recruitment.js` — derecruitment projection with EPS_PROJ margin
- `src/simulation.js` — STEP_FAILED gating; commits state only on success
- `test/conservation.test.js` — updated for new initial PEEP
- `test/a_initialization.test.js` (new) — 11 tests
- `test/b_jacobian.test.js` (new) — 3 tests
- `test/c_small_signal.test.js` (new) — 1 test
- `test/f_recruitment.test.js` (new) — 4 tests
- `test/g_multi_breath.test.js` (new) — 5 tests
- `test/h_dt_convergence.test.js` (new) — 3 tests
- `test/i_failure_semantics.test.js` (new) — 4 tests
- `test/j_instrumentation.test.js` (new) — 3 tests
- `TEST_RESULTS.json` (new)
- `NUMERICAL_DIAGNOSTICS.json` (new)
- `PERFORMANCE_BENCH.json` (new)

## Honest assessment of remaining work

The v0.4.3 acceptance contract is fully implemented and tested. The
low-PEEP Injury C performance pathology is documented and quantified
but NOT fixed — this is by design (numerical rigor release, not perf).
Future releases should address it via the active-set formulation.

No clinical validation was attempted or claimed.

## v0.4.3 instrumentation fields

`output.solverStats` per step:
- `newtonIters` — Newton iterations this step
- `substeps` — dt subdivision depth (1 = no subdivision)
- `lineSearchHalvings` — count of `stepScale *= 0.5` events
- `activeSetTransitions` — compartment regime crossings
  (CLOSED → FLOOR, INTERIOR → CAP, etc.)
- `residualNorm` — raw Euclidean norm (diagnostic only)
- `scaledResidual` — infinity norm of componentwise-scaled residual
- `converged` — `iterations > 0 && iterations < SOLVER_MAX_ITER`

The `activeSetTransitions` counter enables future work to use
regime-change detection for active-set solver optimization.
