# ARDS Digital Twin v0.4.4 — Review Notes

## Scope

v0.4.4 is a narrow cleanup release that addresses the rejection and
correction directive issued against v0.4.3 rev2. The mechanical and
numerical foundation (closed-form P-V law, analytic Jacobian, scaled
Newton convergence, direction-aware flow feasibility, solver
instrumentation) is preserved.

## Required corrections applied (8 of 8)

1. **No arbitrary recruitment fraction in Injury A/B/C**
   - Removed `initialRecruitmentState: { ..., recruitable: 0.5, ... }`
     from all three injury phenotypes in `src/presets.js`.
   - The phenotype now ships only mechanics. Recruitment state is a
     scenario-level decision; the initializer throws when missing
     rather than guessing 0, 0.37, 0.5, or any other value.

2. **Phenotype does not own initialPEEP**
   - Removed `initialPEEP` from every preset.
   - `Simulation` now requires `initialPEEP` (or pulls from
     `controller.settings.peep` for tests that wire only one side).
   - `makePatientParams` does not preserve an `initialPEEP` field.

3. **Missing recruitment state fails explicitly**
   - `makeInitialState` throws if `initialRecruitmentState` is not
     supplied either via `options` or via the (now-empty) phenotype.
   - The A4 test was rewritten to assert that the missing state
     throws, with an explicit error message.

4. **`npm test` works after fresh unzip**
   - Removed `"type": "module"` from package.json.
   - Added a root `package.json` declaring `"vent-twin-v0.4.4"` v0.4.4
     with `npm test` script pointing to `test/runner.js`.
   - Added `test/runner.js` that walks `test/` and runs each `*.test.js`
     as a subprocess, aggregating pass/fail counts.
   - Verified at /tmp/fresh-unzip: source + test/ + package.json only,
     runs `npm test` → 127/127 passed.

5. **Version metadata v0.4.4**
   - Root package.json: 0.4.4
   - web/package.json: 0.4.4 (no test script — web has no JS tests)
   - TEST_RESULTS.json, NUMERICAL_DIAGNOSTICS.json,
     PERFORMANCE_BENCH.json all versioned v0.4.4.

6. **Direction-aware FLOW infeasibility**
   - `classifyBoundaryFeasibility` (src/mechanics.js):
     - Positive/inspiratory flow: `Q_cmd * dt > Σ max(0, Vmax - V)`
       implies INFEASIBLE_BOUNDARY.
     - Negative/expiratory flow: `|Q_cmd| * dt > Σ max(0, V)`
       implies INFEASIBLE_BOUNDARY.
   - Verified by tests I6 (negative-flow forced failure) and I7
     (small negative flow on populated compartment does NOT trigger
     INFEASIBLE_BOUNDARY).

7. **Tests count is internally consistent**
   - TEST_RESULTS.json: 127 passed, 0 failed
   - IMPLEMENTATION_SUMMARY.md: 127 passed, 0 failed
   - NUMERICAL_DIAGNOSTICS.json test_counts.v0.4.4_total: 127
   - All test-suites listed with their actual per-file pass counts
     (verified by running `test/runner.js` and parsing output).

8. **All artifacts present in return ZIP**
   - TEST_RESULTS.json
   - NUMERICAL_DIAGNOSTICS.json
   - PERFORMANCE_BENCH.json
   - CHANGELOG.md (this file)
   - REVIEW_NOTES.md
   - IMPLEMENTATION_SUMMARY.md
   - HANDOFF_README.md

## Pathologies explicitly NOT fixed

- **Injury C PEEP=5 32% step subdivision.** Measured in
  PERFORMANCE_BENCH.json (~1.5 s wall for 10 s simulated). The
  underlying mechanism (active-set transitions near closure
  boundary) is captured by `solverStats.activeSetTransitions`.
  Proposed fix (active-set/boundary formulation) is reserved for v0.5.
  Per the original reviewer's "instrument before optimizing"
  directive.
- **Direction-aware test for positive-flow infeasibility.** The I1
  test already exercises this case (100 L/s positive flow into 1e-6 L
  capacity → INFEASIBLE_BOUNDARY). The new explicit-direction tests
  are I6 and I7 (negative-flow forcible and feasible).

## Validation steps performed

1. Fresh unzip → `cp -r src test package.json /tmp/fresh-unzip/`
2. `cd /tmp/fresh-unzip && npm test` → 127/127 passed
3. `npm test` from project root → 127/127 passed
4. No `recruitable: 0.5` in `grep "recruitable" src/presets.js`
5. No `initialPEEP` in `grep "initialPEEP" src/presets.js`
6. package.json reports 0.4.4
7. Positive and negative FLOW infeasibility tests both exist
8. All JSON/docs report 127 passed / 0 failed
