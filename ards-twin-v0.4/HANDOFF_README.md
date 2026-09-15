# ARDS Digital Twin v0.4.3 — Handoff README

## What's in this package

```
ards-twin-v0.4/
├── src/                    # Source code
│   ├── compartments.js     # Elastic law, Vmax, conductance, Jacobian
│   ├── contracts.js        # makeInitialState (v0.4.3 contract)
│   ├── mechanics.js        # ThreeCompartmentMechanics, scaled convergence
│   ├── recruitment.js      # stepRecruitmentWithFloor + projection rule
│   ├── simulation.js       # STEP_FAILED contract
│   ├── ventilator/         # VC-A/C and PC-A/C controllers
│   ├── gas_exchange.js
│   ├── metrics.js
│   └── ...
├── test/                   # 123 tests, 21 files
│   ├── a_initialization.test.js     # Section A (11)
│   ├── b_jacobian.test.js           # Section B (3)
│   ├── c_small_signal.test.js       # Section C (1)
│   ├── d_low_resistance.test.js     # Section E (2)
│   ├── conservation.test.js         # Section D (8)
│   ├── f_recruitment.test.js        # Section F (4)
│   ├── g_multi_breath.test.js       # Section G (5)
│   ├── h_dt_convergence.test.js     # Section H (3)
│   ├── i_failure_semantics.test.js  # Section I (4)
│   ├── j_instrumentation.test.js    # Section J (3)
│   ├── p0_*.test.js ...             # Section D details
│   ├── p1_*.test.js ...
│   └── ...
├── web/                    # Browser UI bundle
│   ├── app.js              # Updated import: ./ards-v043.bundle.js
│   ├── index.html
│   ├── package.json
│   ├── playwright.config.js
│   ├── ui.spec.js          # Playwright tests (browser-level)
│   └── ards-v043.bundle.js # v0.4.3 ESM bundle
├── TEST_RESULTS.json       # Pass/fail per suite
├── NUMERICAL_DIAGNOSTICS.json
├── PERFORMANCE_BENCH.json
├── CHANGELOG.md
├── REVIEW_NOTES.md
├── IMPLEMENTATION_SUMMARY.md
└── HANDOFF_README.md       # (this file)
```

## How to run

```bash
# All Node-side tests (123 total)
cd ~/medical-vent-twin/ards-twin-v0.4
for t in test/*.js; do node "$t" 2>&1; done

# Browser UI tests (8 total)
cd web && { python3 -m http.server 8771 --bind 127.0.0.1 & }
PLAYWRIGHT_BROWSERS_PATH=$HOME/Library/Caches/ms-playwright \
  BASE_URL=http://localhost:8771/web/ \
  npx playwright test
```

## What changed from v0.4.2

- `makeInitialState` requires preset-owned `initialPEEP` + `initialRecruitmentState`
- Mechanics uses analytic Jacobian `K/(Vmax-V)` instead of finite-difference
- Convergence criterion is scaled `‖R̂‖∞ < 1e-3` (was: raw `< 1e-5`)
- Solver failure = STEP_FAILED: state not advanced, time not advanced
- INFEASIBLE_BOUNDARY is distinct from SOLVER_NONCONVERGENCE
- Derecruitment uses projection rule with `EPS_PROJ = 1e-6` margin
- Each mechanics step carries machine-readable `solverStats`

## What did NOT change

- All 89 v0.4.2 baseline tests still pass
- Mechanics architecture (implicit Newton, FLOW/PRESSURE boundaries,
  availability-scaled conductance, exponential elastic law)
- Controller API (VC-A/C and PC-A/C)
- Browser UI bundle path

## Known limitation (NOT a bug)

Injury C PEEP=5 dt=1ms takes ~2 s wall-clock per 10 s simulated time.
32% of steps subdivide (substeps=2). Zero failures, correct results.
Fix is left for v0.5 per the reviewer's "instrument before optimizing"
directive. See `REVIEW_NOTES.md` for details.

## For the next maintainer

- `TEST_RESULTS.json` is the authoritative pass/fail record
- `NUMERICAL_DIAGNOSTICS.json` quantifies solver behavior across presets
- `PERFORMANCE_BENCH.json` quantifies wall-clock + solver work
- `REVIEW_NOTES.md` documents the design rationale
- `IMPLEMENTATION_SUMMARY.md` walks through phase-by-phase

If you're picking up v0.5 work, start with the active-set/boundary
formulation in `src/mechanics.js` to address the Injury C PEEP=5
pathology. The instrumentation in `output.solverStats` will tell you
whether your fix helps.
