# ARDS Digital Twin v0.4.4 — Handoff README

## Quick start

```bash
unzip vent-twin-v0.4.4-return.zip
cd vent-twin-v0.4
npm test
```

Expected output: `TOTAL: 127 passed, 0 failed`.

## What's in the package

```
vent-twin-v0.4/
├── package.json              # npm test runs test/runner.js
├── src/                      # Source code
│   ├── contracts.js          # makeInitialState, makePatientParams, …
│   ├── presets.js            # Phenotypes (mechanics only, no initial state)
│   ├── mechanics.js          # ThreeCompartmentMechanics, direction-aware classifyBoundaryFeasibility
│   ├── recruitment.js        # stepRecruitment, capacityMultiplier
│   ├── simulation.js         # Simulation requires initialPEEP + initialRecruitmentState
│   ├── ventilator/           # VC/PC controllers
│   ├── gas_exchange.js
│   └── metrics.js
├── test/                     # 21 .test.js files + runner.js
├── web/                      # Browser harness (index.html, app.js)
├── TEST_RESULTS.json         # 127/0 totals
├── NUMERICAL_DIAGNOSTICS.json # Solver failures, conservation residuals
├── PERFORMANCE_BENCH.json    # Wall-clock vs mechanics_steps
├── CHANGELOG.md
├── REVIEW_NOTES.md
├── IMPLEMENTATION_SUMMARY.md
└── HANDOFF_README.md (this file)
```

## v0.4.4 contract (phenotype vs scenario)

**Phenotype (PatientParams) owns:**
- compartment fractions, resistances, capacities, K
- perfusion / deadSpace fractions
- central airway resistance
- airway opening pressure (AOP) — intrinsic tissue property

**Scenario (Simulation args) owns:**
- initialPEEP
- initialRecruitmentState (or initializationHistory, reserved for v0.5)
- ventilator mode + settings (FiO2, PEEP, RR, Vt, etc.)
- control/timing parameters

**Initializer:** throws explicitly when initialPEEP or
initialRecruitmentState is missing. Never silent-defaults.

## Direction-aware FLOW feasibility

| Flow direction | Bound | Source |
|----------------|-------|--------|
| Positive (inspiratory) | `Q*dt ≤ Σ max(0, Vmax - V)` | remaining available capacity |
| Negative (expiratory) | `|Q|*dt ≤ Σ max(0, V)` | removable current gas volume |

When the requested boundary violates the bound for its direction,
the solver classifies the failure as `INFEASIBLE_BOUNDARY`. Otherwise,
failure is `SOLVER_NONCONVERGENCE` (the constrained nonlinear solve
remains authoritative).

## Test result (independent of npm)

```bash
node test/runner.js
```

Produces per-suite pass counts aggregated to a single TOTAL.
127 passed, 0 failed at the time of this writing.
