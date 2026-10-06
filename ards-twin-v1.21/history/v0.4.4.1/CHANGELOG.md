# Mechanistic Lung Simulator — Changelog

## v0.4.4.1 (2026-09-16 14:55 UTC) — Final label cleanup (browser UI + documentation headers)

Applied the FINAL_LABEL_CLEANUP_DIRECTIVE from the other LLM agent's handoff (`vent-v0.4.4.1-final-label-cleanup-handoff.zip`, Drive id `10h02WOlTA89AfVPvXT-HbJ9wzwdIlvC0`).

UI / documentation label cleanup only. Mechanics, solver, and phenotype parameters unchanged.

**Browser UI (`web/index.html`):**
- Title: `ARDS Digital Twin v0.4.2` → `Mechanistic Lung Simulator v0.4.4.1`
- Header h1: `ARDS Digital Twin v0.4.2` → `Mechanistic Lung Simulator v0.4.4.1`
- Preset option labels: removed `mild` / `moderate` / `severe` clinical-severity suffix; switched to `Reference phenotype (healthy)` / `Low-recruitability phenotype (mechanical construct)` / etc.
- About-section: `v0.4.2 mechanics` → `v0.4.4.1 mechanics`; test count `89/89` → `127/127`; added phenotype-construct disclaimer.
- Footer: `v0.4.2 handoff README` → `v0.4.4.1 handoff README`; deployment URL cleaned.

**UI tests (`web/ui.spec.js`, `web/playwright.config.js`):**
- Title regex: `ARDS Digital Twin v0.4.2` → `Mechanistic Lung Simulator v0.4.4.1`
- Header h1 assertion: same update
- `Baseline` / `ARDS v0.4.2` / `mild` references in test descriptions replaced with neutral phenotype labels

**Documentation headers (`*.md`):**
- `CHANGELOG.md`: `# ARDS Digital Twin — Changelog` → `# Mechanistic Lung Simulator — Changelog`
- `IMPLEMENTATION_SUMMARY.md`, `REVIEW_NOTES.md`, `HANDOFF_README.md`: carry the v0.4.4.1 subtitle but the project-name portion uses the same artifact name.

**JSON / metadata (`PERFORMANCE_BENCH.json`):**
- `version`: `v0.4.4` → `v0.4.4.1`
- `date`: refreshed to current run timestamp

**Out-of-scope (unchanged):**
- v0.4.2 historical code comments in `src/mechanics.js`, `src/recruitment.js`, `src/contracts.js`, `src/compartments.js` — these refer to the v0.4.2 mathematical model spec the source implements and are clearly historical.
- Mechanical parameters, solver, and phenotype parameter values — unchanged from v0.4.4.

Tests: 127/127 passed across 21 test files.

## v0.4.4.1 (2026-09-16 14:55:00 UTC) — Preset rename (mechanical-construct labels)

Mechanical parameters unchanged from v0.4.4. Only the externally-exposed labels changed.

- `Baseline` → `phenotype_baseline`
- `phenotype_low_recruitability` (mild ARDS) → `phenotype_low_recruitability`
- `phenotype_moderate_recruitability` (moderate ARDS) → `phenotype_moderate_recruitability`
- `phenotype_high_recruitability` (severe ARDS) → `phenotype_high_recruitability`

Rationale: the labels are mechanical-construct descriptors (recruitable pool size), not clinical ARDS severity grades. The new labels make that distinction explicit.

Tests: 127/127 passed across 21 test files.

Cascaded changes: `src/presets.js`, 8 test files, `web/ui.spec.js`, `web/index.html`, `web/ards-v044.bundle.js`, `MANUSCRIPT.md`, `CHANGELOG.md`, `REVIEW_NOTES.md`, `IMPLEMENTATION_SUMMARY.md`, `TEST_RESULTS.json`, `NUMERICAL_DIAGNOSTICS.json`, `PERFORMANCE_BENCH.json`.

## v0.4.4 (2026-09-16 13:18:06 UTC) — Cleanup release for v0.4.4 acceptance

Addresses the v0.4.4 rejection/correction directive. The mechanical/numerical
foundation is preserved; only the explicitly listed cleanup defects were fixed.

### Required corrections applied

- **Phenotype no longer owns initialPEEP.** Moved to the simulation
  scenario. `Simulation` constructor requires `initialPEEP` (or falls
  back to `controller.settings.peep`); the phenotype does not imply
  a ventilator setting.
- **No `recruitable: 0.5` guessing in presets.** phenotype_low/moderate/high_recruitability
  phenotypes are pure mechanics; they no longer ship with an invented
  initial recruitment fraction.
- **`initialRecruitmentState` is required.** `makeInitialState` and
  `Simulation` throw with explicit errors when either
  `initialPEEP` or `initialRecruitmentState` is missing.
- **CommonJS only.** Removed `"type": "module"` from package.json
  declarations; source uses `require`/`module.exports` throughout.
- **`npm test` works after fresh unzip.** Added `test/runner.js` and
  root `package.json` script.
- **Version metadata v0.4.4.** Root and web packages both v0.4.4.
- **Direction-aware FLOW infeasibility.** `classifyBoundaryFeasibility`
  uses remaining capacity (`Σ max(0, Vmax - V)`) for inspiratory flow
  and removable volume (`Σ max(0, V)`) for expiratory flow.

### Tests

- v0.4.3 baseline: 125 passed
- v0.4.4 additions: 2 (I6 negative-flow infeasibility, I7 feasible
  expiration does not trigger INFEASIBLE_BOUNDARY)
- **v0.4.4 total: 127 passed, 0 failed**

### Mechanics (unchanged from v0.4.3)

- Finite-capacity exponential P-V law
- Analytic dP/dV = K/(Vmax - V) Jacobian
- Central + branch resistance topology
- Constrained volume bounds (V ∈ [0, (1-EPS_CAP) * Vmax])
- Failed-step semantics (no time/state advancement)
- Derecruitment feasibility projection (EPS_PROJ = 1e-6)
- Scaled convergence framework (SOLVER_TOL_SCALED = 1e-3)
- VC/PC controller separation
- Low-R behavior (Ppeak-Pplat → 0)
- Timestep-convergence framework
- Solver instrumentation: newtonIters, substeps, lineSearchHalvings,
  activeSetTransitions, residualNorm, scaledResidual, converged

## v0.4.3 (2026-09-15) — Numerical rigor rewrite

### Breaking changes from v0.4.2
- `makeInitialState(params, options)` — closed compartments (capacity=0)
  are exactly closed at V=0 with G=0; zero-capacity trachea-equivalent.
- Three-regime initialization: closed / elastic / lower-bound.
- Pressure-consistent initialization (V derived from P_alv, not guessed).
- Analytic Jacobian dP_el/dV = K/(Vmax - V) replaces finite-difference.
- Dimensionlessly scaled Newton convergence (‖R̂‖∞ < 1e-3, with
  V_scale floor = 0.01 L, P_scale based on |pBranch|, |AOP|).
- Test coverage: 89 (v0.4.2 baseline) + 36 (v0.4.3 acceptance) = 125.
