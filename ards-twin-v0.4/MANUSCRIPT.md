# A Three-Compartment Mechanistic Lung Simulator for Mechanical Ventilation Education: Development and Computational Verification

Release v0.4.4.1 | Computational development report | Not peer reviewed

Author, affiliation, correspondence and ORCID: pending owner completion before journal submission.

---

## Abstract

**Background.** Mechanical ventilation education depends on inspectable software that distinguishes structural failure from solver non-convergence in mechanistically defined parameter regimes. A clean separation between intrinsic tissue parameters (phenotype) and scenario-specific clinical decisions (initial PEEP, initial recruitment state) prevents silent defaulting, supports scenario reproducibility, and enables direction-aware feasibility classification.

**Objective.** To describe a numerical-rigor release of a three-compartment educational ventilator simulator, separating phenotype from scenario, providing explicit, machine-readable solver instrumentation, and reporting computational verification within the tested domain.

**Methods.** The model comprises three quasi-static tissue compartments with finite-capacity exponential elastic laws, one lumped central airway resistance plus per-compartment branch resistance, and discrete recruitment relays with pressure-history-projected feasibility constraints. The Newton solver uses an analytic Jacobian and dimensionlessly scaled convergence. Boundary feasibility classification is direction-aware: positive/inspiratory flow is bounded by remaining available capacity; negative/expiratory flow is bounded by removable gas volume. The phenotype owns only tissue mechanics, central airway resistance, and airway opening pressure (AOP). The simulation scenario owns initial PEEP, initial recruitment state, and ventilator settings. Missing recruitment state is rejected explicitly rather than guessed. Phenotypes are mechanical constructs labeled by their recruitable pool size, not validated clinical ARDS severity grades.

**Results.** 127 acceptance assertions passed, 0 failed, across 21 test files under Node v26.8.2 in CommonJS mode. Acceptance sections covered (A) initialization with rejected-on-missing-state contract; (B) analytic Jacobian vs numerical derivative; (C) single-compartment small-signal `τ ≈ R · C_tan`; (D) flow and pressure conservation across the central + branch topology; (E) low-resistance limit `P_peak − P_plat → 0` across three decades; (F) closed-compartment invariants and derecruitment feasibility projection; (G) multi-breath VC and PC simulation stability with zero solver failures across all mechanical-construct phenotypes; (H) monotone timestep convergence at 2 ms / 1 ms / 0.5 ms; (I) STEP_FAILED contract preserving time and state on solver failure, distinct INFEASIBLE_BOUNDARY vs SOLVER_NONCONVERGENCE classifications, separate positive and negative direction-aware feasibility tests; (J) machine-readable per-step solver instrumentation including Newton iteration count, subdivision depth, line-search halvings, and active-set transitions. Performance: the High-recruitability phenotype PEEP = 5 cmH₂O scenario at dt = 1 ms completes 10 s of simulated time in 1.5 s wall-clock with zero solver failures and 32 % of steps subdivision-bounded (this 32 % figure is for the 10 s fixed-duration scenario; the J-4 scenario at 3 breaths reports 0 % subdivision). All reported numbers are simulator outputs in the tested domain, not cohort fits, not clinical realism claims, not diagnostic classifications.

**Conclusions.** This artifact provides an executable, inspectable mechanistic lung simulator and reproducible evidence of computational consistency within its tested domain. The phenotype/scenario separation prevents one of the recurring failure modes of educational simulators (silent defaulting of clinical decisions). Direction-aware feasibility classification gives a model consumer an interpretable basis for distinguishing structurally impossible boundaries from transient non-convergence. The artifact is an educational exploration prototype, not a clinical decision tool. Passing the numerical test battery does not establish biological or clinical validity. "Digital twin" terminology is reserved for future, patient-specific, calibrated-to-measured-data systems and does not apply to the current artifact.

Keywords: mechanical ventilation; educational simulator; computational verification; compartmental lung mechanics; recruitment; numerical methods; Newton solver; phenotype/scenario separation

---

## 1. Introduction

Mechanical ventilation education depends on inspectable software. A useful educational simulator must (a) state what it assumes about physiology, (b) report what it does to its state, and (c) fail loudly when the user's request is structurally impossible, not silently. This release focuses on the third property by combining four design decisions:

1. **Phenotype / scenario separation** — the patient's tissue mechanics (compartment fractions, resistances, capacities, elastic stiffness, AOP) is decoupled from the clinical scenario (initial PEEP, initial recruitment state, ventilator settings).
2. **Analytic Jacobian** — the Newton solver uses `dP_el/dV = K/(Vmax − V)`, so convergence behavior is reproducible across regimes.
3. **Dimensionlessly scaled convergence** — the residual is normalized by componentwise `V_scale = min(V_max, 0.01 L)` (an upper cap on the volume normalization scale) and `P_scale = max(|pBranch|, |AOP|, 1)`.
4. **Direction-aware flow feasibility** — the boundary classifier distinguishes inspiratory (`Q·dt > Σ max(0, Vmax − V)`) from expiratory (`|Q|·dt > Σ max(0, V)`) infeasibility.

These four choices arose from observed failure modes in v0.4.2 / v0.4.3 work (silent defaulting of recruitment at `recruitable = 0.5`, finite-difference Jacobian drift, false fixed-point lock-in at large V_scale, misclassification of expiratory over-removal as inspiratory capacity overflow). Each acceptance section in §3 corresponds to one of these failure modes.

The artifact is an **educational exploration prototype**, not a clinical decision tool. It is also **not a "digital twin"** as that term is used in the patient-specific, calibrated-to-measured-data literature; the term is reserved here for a future, calibrated system and the current artifact is described as a "mechanistic lung simulator." Passing selected tests does not establish physiological realism; verifying software does not establish clinical validity. Both caveats are repeated throughout and called out in §6.

## 2. Methods

### 2.1 Phenotype / scenario separation

The phenotype (an immutable PatientParams object) owns:

- compartment fractions, resistances, capacities, elastic stiffness `K`,
- perfusion and dead-space fractions,
- central airway resistance,
- airway opening pressure `AOP` (intrinsic tissue property, not a ventilator setting).

The simulation scenario (caller-supplied initial state) owns:

- `initialPEEP`,
- `initialRecruitmentState` (or `initializationHistory`, reserved for v0.5),
- ventilator mode and settings (FiO₂, PEEP, RR, Vₜ, inspiratory flow, pause, etc.),
- control / timing parameters.

The initializer (`makeInitialState`) throws explicitly when `initialPEEP` or `initialRecruitmentState` is missing. There is no silent `recruitable: 0.5` default. This prevents two classes of failure observed in earlier releases: (a) tacit guesses propagating into the comparator pipeline when phenotypes and scenarios disagreed on hidden state, and (b) reviewers inferring clinical decisions from preset-defined recruiter fractions.

### 2.2 Phenotype labels (v0.4.4.1 mechanical-construct naming)

The four simulator phenotypes are **mechanical constructs labeled by their recruitable pool size**, not validated clinical ARDS severity grades. The mapping from internal code identifier to the display label used in this manuscript is:

| Code identifier | Display label |
|-----------------|---------------|
| `phenotype_baseline` | Reference phenotype |
| `phenotype_low_recruitability` | Low-recruitability phenotype |
| `phenotype_moderate_recruitability` | Moderate-recruitability phenotype |
| `phenotype_high_recruitability` | High-recruitability phenotype |

Where this manuscript cites benchmark scenarios (e.g., "the High-recruitability phenotype, PEEP = 5 cmH₂O scenario"), the underlying phenotype mechanical parameters are unchanged from v0.4.4. The labels were renamed in v0.4.4.1 to make explicit that the phenotypes are mechanical constructs and not clinical ARDS severity strata; they are not mapped to Berlin ARDS severity grades or any cohort-derived classification.

### 2.3 Constitutive law and analytic Jacobian

For each compartment i, with state (V_i, r_i) and preset parameters (capacity, elastic stiffness K_i, AOP), the open-volume regime uses the exponential elastic law:

```
Vmax_i(r_i) = a(r_i) · Vcap_i
V_i       = Vmax_i(r_i) · [1 − exp(−(P_i − AOP) / K_i)]    for P_i ∈ [AOP, AOP + K_i · ln(1/(1 − ε)))
```

where:
- `V_i` — current gas volume in compartment i (L),
- `Vmax_i(r_i)` — available gas capacity at recruitment r_i (L),
- `r_i` — recruitment state, dimensionless ∈ [0, 1],
- `a(r_i)` — availability factor mapping recruitment to capacity, dimensionless,
- `Vcap_i` — preset nominal capacity (L),
- `P_i` — compartment pressure (cmH₂O),
- `AOP` — airway opening pressure (cmH₂O), intrinsic tissue property,
- `K_i` — elastic stiffness (cmH₂O).

The admissible regime is `V_i ∈ [0, Vmax_i(r_i) − ε_V · Vmax_i]` with `ε_V = 1e-6` (finite-capacity constraint). Closed compartments (`Vcap_i ≈ 0`) are exactly closed: `V_i = 0`, `r_i = 0`. The lower-bound regime handles the case where the elastic law would otherwise predict a negative volume under the assigned PEEP, in which case V is clamped at the closed end. These regimes are described in `src/contracts.js` and `src/compartments.js`.

The Jacobian used by the Newton solver is:

```
dP_el/dV = K / (Vmax(r) − V)
```

from `src/compartments.js:dPressureDVolume`. The B acceptance section verifies this against a finite-difference reference at relative tolerance 1e-3 across mechanistically defined operating points.

### 2.4 Scaled convergence

The Newton system solves for `ΔV_i` and `pBranch` simultaneously, with the global flow row enforcing `Σ ΔV_i / dt = Q_requested`. Convergence is decided on:

```
sup_i |F_i / scale_i| < 1e-3
```

with

```
V_scale = min(vmaxMin, 0.01 L)    // 0.01 L is an UPPER CAP on the volume
                                   // normalization scale; it prevents fixed-point
                                   // lock-in at very large V_max by bounding how
                                   // tolerant the solver can be at large volume
P_scale = max(|pBranch|, |AOP|, 1)
```

The `V_scale = min(vmaxMin, 0.01 L)` cap matters: a v0.4.2 model with `V_scale = V_max` allowed Newton to lock in at a sub-equilibrium volume (`V = 0.21` for a `V_eq = 0.33` test case) because the implicit-Euler residual was below the tolerance boundary everywhere along that branch. The cap forces the residual to be normalized against a small reference scale when `vmaxMin > 0.01 L`, so a sub-equilibrium volume can no longer hide inside the tolerance.

### 2.5 Direction-aware flow feasibility

When the Newton solver fails to converge within `SOLVER_MAX_ITER`, a feasibility classifier is invoked:

- **Positive / inspiratory flow** (`Q_cmd ≥ 0`): if `Q_cmd · dt > Σ max(0, (1 − EPS_CAP) · Vmax_i − V_i) + ε`, classify `INFEASIBLE_BOUNDARY`.
- **Negative / expiratory flow** (`Q_cmd < 0`): if `|Q_cmd| · dt > Σ max(0, V_i) + ε`, classify `INFEASIBLE_BOUNDARY`.
- Otherwise, classify `SOLVER_NONCONVERGENCE`.

The constrained nonlinear solve remains authoritative. These are necessary conditions for fast-fail classification, not sufficient.

### 2.6 Failure semantics

A failed step (`output.solverFailure === true`) **does not advance** state time and does not commit a partially-solved `V`. The contract is verified by:

- I1: STEP_FAILED contract — `state.t` and `state.totalVolume` unchanged on failure,
- I2: trace integrity — failed-step entries are not appended,
- I3/I5: `INFEASIBLE_BOUNDARY` is distinct from `SOLVER_NONCONVERGENCE`,
- I6: forced negative-flow infeasibility,
- I7: feasible expiration does NOT trigger `INFEASIBLE_BOUNDARY`.

### 2.7 Test infrastructure

- CommonJS (`require` / `module.exports`) throughout `src/` and `test/`.
- 21 test files in `test/*.test.js`, each run as a Node subprocess by `test/runner.js`.
- `npm test` runs every test file and aggregates per-file pass / fail totals.

### 2.8 What is NOT evaluated

This report does not evaluate:

- Browser rendering quality,
- Patient-specific calibration against measured clinical data,
- Mapping of the four mechanical-construct phenotypes to Berlin ARDS severity grades (the phenotypes are model constructs, not clinical strata),
- Bench / wall-clock optimization of the active-set formulation (documented but not removed),
- Expert face validity,
- Learning outcomes.

These are out of scope for a computational verification report and remain to be done before any claim of educational efficacy or patient-specific utility.

## 3. Results

### 3.1 Test totals

```
TOTAL: 127 passed, 0 failed
```

across 21 test files in CommonJS mode under Node v26.8.2.

### 3.2 Per-file counts

| Test file | Pass | Fail |
|-----------|-----:|-----:|
| a_initialization.test.js        | 11 | 0 |
| b_jacobian.test.js              |  3 | 0 |
| c_small_signal.test.js          |  1 | 0 |
| conservation.test.js            |  8 | 0 |
| d_low_resistance.test.js        |  2 | 0 |
| deterministic.test.js           |  6 | 0 |
| f_recruitment.test.js           |  4 | 0 |
| g_multi_breath.test.js          |  5 | 0 |
| h_dt_convergence.test.js        |  3 | 0 |
| i_failure_semantics.test.js     |  7 | 0 |
| j_instrumentation.test.js       |  4 | 0 |
| p0_central_airway.test.js       |  7 | 0 |
| p0_single_compartment.test.js   |  9 | 0 |
| p1_gas_toggle.test.js           |  4 | 0 |
| p2_metrics.test.js              | 10 | 0 |
| p3_pc_ac.test.js                |  6 | 0 |
| p4_recruitment.test.js          |  7 | 0 |
| p5_gas_exchange.test.js         | 11 | 0 |
| single_rc.test.js               |  5 | 0 |
| strict_vc_ac.test.js            |  8 | 0 |
| vc_ac.test.js                   |  6 | 0 |
| **TOTAL**                       | **127** | **0** |

### 3.3 Acceptance gate (against §2 design decisions)

| Section | Assertion | v0.4.4.1 status |
|---------|-----------|-----------------|
| A | Pressure-consistent init + closed-compartment invariant + lower-bound regime + **missing recruitment state throws explicitly** | 11 / 11 |
| B | Analytic Jacobian `dP/dV = K/(Vmax − V)` matches numerical derivative at tol 1e-3 | 3 / 3 |
| C | Small-signal `τ ≈ R · C_tan` within 30 % at single-compartment equilibrium | 1 / 1 |
| D | Flow conservation; `Q_central = Σ Q_branch`; `P_vent = P_branch + Q · R_central` exact-by-construction | 8 / 8 |
| E | `P_peak − P_plat → 0` across 3 decades of branch resistance | 2 / 2 |
| F | Closed-compartment invariants + derecruitment projection (`EPS_PROJ = 1e-6`) | 4 / 4 |
| G | VC and PC multi-breath stability across all mechanical-construct phenotypes, zero solver failures | 5 / 5 |
| H | Monotone convergence at 2 / 1 / 0.5 ms across VC and PC scenarios | 3 / 3 |
| I | STEP_FAILED contract preserves state, INFEASIBLE_BOUNDARY (positive + negative flow) distinct from SOLVER_NONCONVERGENCE | 7 / 7 |
| J | `output.solverStats.{newtonIters, substeps, lineSearchHalvings, activeSetTransitions, residualNorm, scaledResidual, converged}` per step, all numeric, non-negative; **J-4 verifies at least one active-set transition occurs in the designated benchmark** | 4 / 4 |

### 3.4 Performance benchmark (illustrative, not a correctness gate)

The High-recruitability phenotype, PEEP = 5 cmH₂O scenario at dt = 1 ms over 10 s of simulated time (fixed-duration `PERFORMANCE_BENCH.json` scenario):

| Metric | Value |
|--------|-------|
| Mechanics steps | 10 000 |
| Wall-clock | ~1.5 s |
| Total Newton iters | 5 859 |
| Mean Newton iters/step | 0.59 |
| Steps subdivision-bounded | 31.92 % |
| Active-set transitions (total) | 9 |
| Solver failures | 0 |

The J-4 acceptance test runs the High-recruitability phenotype, PEEP = 5 cmH₂O scenario for **3 breaths** (not 10 s) and verifies that:

- `output.solverStats.activeSetTransitions` is present on every step,
- it is a number (not undefined / null),
- it is non-negative,
- the cumulative total is **at least 1** — that is, J-4 verifies at least one active-set transition occurs in the designated benchmark. The earlier `>= 0` assertion was tightened to `>= 1` in v0.4.4.1 to ensure the test fails if the active-set counter is ever disconnected.
- The observed transition count in the current run is **3** (across 6 924 mechanics steps, with 1.00 mean substeps/step and 0 failures). The transition count is reported via `console.log` in J-4 output.
- This is a **computational-behavior verification**, not a physiologic validation metric. Do not generalize the 3 transitions to "many transitions per second" — at this scenario's dt and duration, the transition rate is roughly 0.43 transitions per second.

Wall-clock time is a benchmark, not a correctness gate. Solver failure counts and conservation residuals (`NUMERICAL_DIAGNOSTICS.json`) are the correctness signals.

### 3.5 Phenotype / scenario separation (regression evidence)

Earlier releases shipped injury presets with `initialRecruitmentState.recruitable = 0.5` baked into the phenotype. v0.4.4 removed that field from every preset. v0.4.4.1 renamed the preset keys to neutral mechanical-construct identifiers; the phenotype parameters themselves are unchanged. Test A-4 verifies that `makeInitialState` now throws when the scenario does not supply recruitment state explicitly. Test runs confirm zero silent guessing: `grep -R "recruitable: 0\." src/presets.js` returns 0 hits.

### 3.6 Constitutive-law and solver invariants

- Closed compartments (`Vcap ≈ 0`) are exactly closed: `V = 0`, `r = 0`, no flow in or out.
- Finite-capacity constraint: `V < (1 − EPS_CAP) · Vmax(r)` always, with `EPS_CAP = 1e-6`.
- Lower-bound regime: when the elastic law would predict `V < 0` under the assigned PEEP, the compartment clamps at `V = 0` rather than going negative.
- Conservation: `Q_central = Σ Q_branch_i` exact-by-construction; `P_vent = P_branch + Q_central · R_central` to solver tolerance.
- Pressure-consistent initialization: starting V derived from P_alv under the elastic law, not guessed.

## 4. Discussion

### 4.1 What this release demonstrates computationally

A simulator can be made internally consistent: the same elastic law, the same Jacobian, the same convergence rule applies uniformly across operating regimes from PEEP = 5 cmH₂O to PEEP = 15 cmH₂O, across VC and PC controller modes, and across the four prespecified mechanical-construct phenotypes (Reference + Low-, Moderate-, High-recruitability). The 127-test acceptance battery passes without manual edits or seeded tolerances; nothing was tuned to a particular case.

### 4.2 What this release does NOT demonstrate

- Physiological accuracy against human cohorts. None of the four mechanical-construct phenotypes is derived from clinical cohort data; they are inspectable scenarios for educational use. The model's selection of `K = 22` cmH₂O for recruitable tissue or `K = 35` cmH₂O for consolidated tissue is a didactic choice, not a literature fit. The phenotypes are not mapped to Berlin ARDS severity grades.
- Patient-specific calibration. The simulator is not calibrated to measured individual-patient data; it is not a "digital twin" in the patient-specific sense.
- Educational efficacy. No learning outcome study is reported here.
- Clinical safety. Step-level failure semantics are enforced in software, but no claim of "safe for clinical use" is made. The artifact is an educational exploration prototype.

### 4.3 What reviewers should check

Three things:

1. **Phenotype / scenario separation.** Look at `src/presets.js`. Each phenotype should ship only `compartments`, `centralAirwayResistance`, and `airwayOpeningPressure`. If a phenotype ships `initialPEEP` or `initialRecruitmentState`, that is a regression to be flagged. The four phenotype keys are `phenotype_baseline`, `phenotype_low_recruitability`, `phenotype_moderate_recruitability`, `phenotype_high_recruitability`.
2. **Failure semantics on `INFEASIBLE_BOUNDARY`.** I6 forces a negative-flow failure (V = 0, asked to remove 100 L·s⁻¹) and verifies `failureKind = INFEASIBLE_BOUNDARY` with `state.t` unchanged. Reviewers can re-run `node test/i_failure_semantics.test.js` to confirm.
3. **`output.solverStats` per step.** J-4 verifies that `solverStats.activeSetTransitions` is present, numeric, and non-negative on every step, and that the cumulative total across the 3-breath run is at least 1. The current observed count is 3. This is the data future work would need for an active-set solver formulation.

### 4.4 Limitations and explicit pathology

- **Active-set transitions are sparse under the High-recruitability phenotype, PEEP = 5 scenario.** Total observed: 3 across 6 924 steps (3 breaths at dt = 1 ms). The transition counter is wired and exercised, but the regime crossings are rare under this preset. The proposed active-set / boundary formulation is reserved for v0.5.
- **No `initializationHistory` recovery.** Caller-supplied `initializationHistory` (an array of past pressures) is currently rejected with a "reserved for future release" error. The contract for it is defined but not implemented.
- **The phenotypes are mechanical constructs, not clinical strata.** Reference / Low-, Moderate-, High-recruitability phenotypes are four prespecified mechanical phenotypes parameterized to span a range of recruitability and stiffness. They are not mapped to Berlin ARDS severity grades.

### 4.5 Reproducibility

- Source: `ards-twin-v0.4/src/` (CommonJS).
- Tests: `ards-twin-v0.4/test/` (21 files, 127 assertions).
- Run: `npm test` from the package root.
- The `test/runner.js` aggregates per-file results into a single `TOTAL: 127 passed, 0 failed`.
- Artifact trail: `TEST_RESULTS.json`, `NUMERICAL_DIAGNOSTICS.json`, `PERFORMANCE_BENCH.json` are auto-generated from the test run.

## 5. Conclusion

The artifact provides an executable, inspectable mechanistic lung simulator and reproducible evidence of computational consistency within its tested domain. Phenotype / scenario separation is enforced; failure semantics are explicit; direction-aware feasibility classification is implemented. The artifact is an educational exploration prototype, not a clinical decision tool, and is not a patient-specific digital twin.

Passing the numerical test battery does not establish clinical realism. Any educational efficacy claim requires a separate study.

## 6. Caveats (mandatory)

This work is **not peer reviewed**. The artifact is an **educational exploration prototype**, **not a clinical decision tool**, and **not a "digital twin"** in the patient-specific sense. The phenotypes are mechanical constructs labeled by their recruitable pool size, not validated clinical ARDS severity strata, and are not mapped to Berlin severity grades or any cohort-derived classification. None of the following are evaluated in this report: physiological accuracy against clinical cohorts, patient-specific calibration, learning outcomes, expert face validity, browser rendering quality. Numbers reported are **simulator outputs in the tested domain**, not cohort fits or diagnostic classifications.

## 7. Availability

### On the website (vent.defying-logic.com)

- Simulator: https://vent.defying-logic.com/ards-twin-v0.4/web/ — runs in the browser, all four presets, VC-A/C and PC-A/C modes, ~1 ms default dt.
- This manuscript: https://vent.defying-logic.com/ards-twin-v0.4/MANUSCRIPT.md
- Manuscript bundle (final, with changelog and review notes):
  - `MANUSCRIPT_FINAL.md` — https://vent.defying-logic.com/ards-twin-v0.4/manuscript/MANUSCRIPT_FINAL.md
  - `MANUSCRIPT_CHANGELOG.md` — https://vent.defying-logic.com/ards-twin-v0.4/manuscript/MANUSCRIPT_CHANGELOG.md
  - `MANUSCRIPT_REVIEW_NOTES.md` — https://vent.defying-logic.com/ards-twin-v0.4/manuscript/MANUSCRIPT_REVIEW_NOTES.md
  - `SHA256SUMS.txt` — https://vent.defying-logic.com/ards-twin-v0.4/manuscript/SHA256SUMS.txt

### In the source repository (this file's source of truth)

- Source: https://github.com/DrFillster/medical-vent-twin/tree/main/ards-twin-v0.4
- Source tree: `ards-twin-v0.4/src/` (CommonJS), `ards-twin-v0.4/test/` (21 files, 127 assertions)
- Run: `npm test` from the project root after `unzip vent-twin-v0.4.4.1-final-clean.zip`

### On GitHub Releases (versioned archives)

- v0.4.4.1 release page: https://github.com/DrFillster/medical-vent-twin/releases/tag/v0.4.4.1
  - `vent-twin-v0.4.4.1-final-clean.zip` — full runnable simulator package + `FINAL_CLEANUP_CHANGELOG.md` + `FINAL_CLEANUP_VERIFICATION.md`
  - `vent-manuscript-v0.4.4.1-final.zip` — manuscript + changelog + review notes + SHA256SUMS

## 8. Reproducibility commands

```bash
# From a clean directory:
unzip vent-twin-v0.4.4.1-final.zip
cd vent-twin-v0.4.1
npm test
# Expect: TOTAL: 127 passed, 0 failed
```

```bash
# Force an INFEASIBLE_BOUNDARY for review:
node -e "
const { ThreeCompartmentMechanics } = require('./src/mechanics.js');
const { makePatientParams, makeInitialState, makeBoundaryFlow } =
  require('./src/contracts.js');
const p = makePatientParams({
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
const s = makeInitialState(p, {
  initialPEEP: 5,
  initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
});
const result = new ThreeCompartmentMechanics().step(
  p, s, makeBoundaryFlow({ flowLps: 100.0, fio2: 0.5 }), 0.001);
console.log(result.output.failureKind, result.output.solverFailure);
// Expect: INFEASIBLE_BOUNDARY true
"
```

```bash
# Inspect J-4 active-set transitions for the High-recruitability phenotype PEEP=5:
node test/j_instrumentation.test.js 2>&1 | grep -E "active-set|J4"
# Expect: "Total active-set transitions: 3" and J4 pass
```

## 9. References

1. Bates JHT. Lung mechanics: an inverse modeling approach. Cambridge University Press; 2009.
2. Mollemans W, et al. Mathematical models of the respiratory system: a review. *Acta Anaesthesiol Belg.* 2005;56(4):387-401.
3. Safadi S, Acho M, Maximous SI, et al. Comparison of web-based and on-site lung simulators for education in mechanical ventilation. *Respir Care.* 2024;69(11):1353-1360. [doi:10.4187/respcare.12072](https://doi.org/10.4187/respcare.12072).
4. Press WH, Teukolsky SA, Vetterling WT, Flannery BP. Numerical Recipes: The Art of Scientific Computing. 3rd ed. Cambridge University Press; 2007. Chapter 9 (Root Finding and Nonlinear Sets of Equations).
5. Amato MBP, Meade MO, Slutsky AS, et al. Driving Pressure and Survival in the Acute Respiratory Distress Syndrome. *N Engl J Med.* 2015;372(8):747-755. [doi:10.1056/NEJMsa1410639](https://doi.org/10.1056/NEJMsa1410639).

---

[Manuscript id: ards-twin-v0.4.4.1-ms-final]
[Compiled: 2026-09-16]
[Bundled at: vent-manuscript-v0.4.4.1-final.zip / MANUSCRIPT_FINAL.md]
