# Mechanistic Lung Simulator v0.4.4.1 — Implementation Summary

> **v0.4.4.1 (this release)** is a phenotype-rename release. Mechanical parameters, solver, and numerical behavior are unchanged from v0.4.4. The four simulator phenotypes are now `phenotype_baseline`, `phenotype_low_recruitability`, `phenotype_moderate_recruitability`, `phenotype_high_recruitability` (display labels: Reference, Low-recruitability, Moderate-recruitability, High-recruitability). The previous v0.4.4 implementation summary is preserved below for historical context.

## What this release is

A narrow cleanup pass against the v0.4.4 rejection/correction
directive. The mechanical foundation established in v0.4.3 is
preserved; only the explicitly listed cleanup defects were fixed.

## Test results

```
TOTAL: 127 passed, 0 failed
```

This breaks down as:

- **v0.4.3 baseline:** 125 passed
- **v0.4.4 new tests:** 2
  - I6: negative-flow infeasibility uses removable volume
    (forced failure on -100 L/s with V=0)
  - I7: small negative flow on populated compartment does NOT
    trigger INFEASIBLE_BOUNDARY (feasible expiration path)

### Per-file pass count

| Suite | Pass | Fail |
|-------|-----:|-----:|
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

## Acceptance gate (against v0.4.4 acceptance criteria)

| Criterion | Status |
|-----------|--------|
| Return filename exactly `vent-twin-v0.4.4-return.zip` | ✓ |
| No arbitrary recruitment fraction in phenotype_low/moderate/high_recruitability | ✓ |
| Phenotype presets do not own initial PEEP | ✓ |
| Simulation scenario provides starting PEEP | ✓ |
| Missing recruitment initialization is never silently guessed | ✓ |
| Fresh unzip + `npm test` succeeds with zero failures | ✓ |
| Package/release version consistently v0.4.4 | ✓ |
| Positive FLOW infeasibility uses remaining capacity | ✓ (test I1) |
| Negative FLOW infeasibility uses removable current gas volume | ✓ (test I6) |
| INFEASIBLE_BOUNDARY is distinct from SOLVER_NONCONVERGENCE | ✓ (tests I3, I5) |
| All test-result/summary artifacts report identical totals | ✓ (127/0 in all) |
| All prior accepted mechanics/regression tests remain passing | ✓ |

## What changed (file-level)

- `src/presets.js` — removed initialPEEP and initialRecruitmentState
  from all four presets; phenotype returns only `compartments`,
  `centralAirwayResistance`, `airwayOpeningPressure`.
- `src/contracts.js` — `makePatientParams` no longer preserves those
  fields; `makeInitialState` throws when missing recruitment state.
- `src/simulation.js` — `Simulation` constructor requires
  `initialPEEP` and `initialRecruitmentState` (or `initializationHistory`,
  which is reserved).
- `src/mechanics.js` — `classifyBoundaryFeasibility` is now
  direction-aware: positive/inspiratory flow checks against
  remaining capacity; negative/expiratory flow checks against
  removable gas volume.
- `test/*.js` — every test that called `makeInitialState` or
  `new Simulation` is updated to supply initialPEEP and
  initialRecruitmentState explicitly. Test a_initialization's
  A4 test is rewritten to assert the explicit failure.
- `test/i_failure_semantics.test.js` — added I6 and I7 for
  direction-aware FLOW feasibility.
- `test/runner.js` — new file, `npm test` entry point.
- `package.json` (root) — name vent-twin-v0.4.4, v0.4.4,
  `npm test` script.
- `web/package.json` — v0.4.4 (no test script).
- `web/ards-v044.bundle.js` — rebuilt.
- `web/app.js` — imports v0.4.4 bundle.
- All five JSON/MD artifacts regenerated for v0.4.4.

## Deliverable

`vent-twin-v0.4.4-return.zip` containing:

- src/ + test/ + web/
- TEST_RESULTS.json (127/0)
- NUMERICAL_DIAGNOSTICS.json (127/0)
- PERFORMANCE_BENCH.json (4 scenarios)
- MANUSCRIPT.md (publication-style report)
- CHANGELOG.md
- REVIEW_NOTES.md
- IMPLEMENTATION_SUMMARY.md (this file)
- HANDOFF_README.md
