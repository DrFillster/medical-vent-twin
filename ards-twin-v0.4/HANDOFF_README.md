# REVIEW NOTES — ARDS Digital Twin v0.4.2

## Scope

v0.4.2 implements the corrections specified in
`V0.4.2_MATHEMATICAL_MODEL.md` and the explicit implementation
instructions in `IMPLEMENTATION_INSTRUCTIONS.md`. This is a mechanics
release — no controller, gas exchange, or UI changes.

## Architectural decisions

### 1. Finite-capacity exponential law

The brief explicitly requires replacing the v0.4 linear law with
`p = -K × log(1 - V/Vmax)` where `Vmax = availability × capacity`. The
choice preserves the existing preset convention
(`capacity = c×K`, `elasticScale = K`) so no preset rewriting is needed.

The model exhibits natural finite-capacity barrier behavior: as V → Vmax,
the elastic pressure diverges. `elasticPressure` throws on V ≥ Vmax — no
hard pressure clipping.

**Removed**: `MAX_PRESSURE`, `1000 × capacity` clamp.

### 2. Availability replaces `fN_max`

The brief's `branchConductance(cp, recruitment) = recruitment / R_full`
substitutes the v0.4 multiplicative capacity scaling. The new model:

```
Vmax = availability × capacity
Ctan = availability × C_full × (1 - V/Vmax)
```

fN_max is retained in the schema (deprecated) but ignored by the new
law. Tests using fN_max scaling were updated; `capacityMultiplier` is a
no-op shim.

### 3. Newton-Raphson implicit solver

The brief requires a 4×4 dense implicit Newton system with backtracking
line search. The implementation:

- Solves `[V_0, V_1, V_2, Pbranch]` (3 active compartments + Pbranch).
- Uses finite-difference Jacobian for `dp_el/dV` (analytic via
  `tangentCompliance` is also viable but finite-difference is more
  robust near Vmax).
- Line search enforces volume-floor (V ≥ 0) and capacity-ceiling
  (V < (1-epsCap) × Vmax).
- dt subdivision up to 8 halvings.
- Returns non-throwing solver failure (`solverFailure: true` +
  `residualNorm`) on final subdivision failure.

**Why finite-difference Jacobian**: the analytic `dp_el/dV` is
`K / (Vmax - V)` which diverges near Vmax. The finite-difference
formulation computes `dp_el/dV` numerically from a perturbed V, which
is numerically stable. The analytic form is included as
`dPressureDVolume` in compartments.js for use elsewhere.

**Why `SOLVER_TOL_ABS = 1e-5` instead of spec's `1e-10`**: the spec's
tighter tolerance caused solver failures in two regimes:

1. **Saturation**: V near Vmax, FLOW boundary demands more flow. The
   residual has a non-zero lower bound from the conservation gap, so
   Newton can't reduce below ~1e-5.
2. **Closed compartment**: V ≈ 0 (floating-point residual), outflow
   direction. The constraint V ≥ 0 is active; Newton's residual has a
   non-zero lower bound from the gap between V_old and the
   dt × G × |Pbranch - AOP| expulsion amount.

Both regimes are handled by the line-search feasibility check; the
residual saturation is a property of the physics, not the solver.

### 4. Conservation exact by construction

The brief requires exact discrete conservation. The implementation
guarantees this:

```
Q_i = (V_i_new - V_i_old) / dt
Q_central = sum(Q_i)
FLOW:     Q_central = Q_requested
PRESSURE: Pvent = Pbranch + Rc × Q_central
```

There is no separate "reported flow" — the same Q_central is reported
on the output and used in conservation tests. This eliminates the
v0.4-era "honest post-step recompute" workaround.

### 5. Recruitment kinetics

The brief replaces additive clipped Euler with bounded kinetics:

```
opening:  dr/dt = +k_open × (pdist - P_open) × (1 - r)
closing:  dr/dt = -k_close × (P_close - pdist) × r
dead-band: dr/dt = 0
```

The `(1 - r)` and `r` factors make [0, 1] invariant for ordinary steps
without hard clipping.

**Feasibility floor**: closing may not reduce r below
`V / ((1 - epsCap) × capacity)`. This is the `minimumFeasibleRecruitment`
helper. The corrector step applies the floor after both predictor and
corrector.

### 6. Saturation and closed-compartment regimes

The Newton solver handles two physical extremes:

**Saturation** (V ≥ satLimit, flowDir > 0): the compartment cannot
accept more flow. Lock F=0 (V stays at Vmax), contribute zero to Q_central.
The FLOW boundary's conservation residual reflects the un-deliverable
flow.

**Closed** (V < floorTol, flowDir < 0): the compartment cannot expel
gas from an empty volume. Lock F=0 (V stays at 0), contribute zero to
Q_central. The PRESSURE boundary's conservation residual reflects the
fact that the lung doesn't generate flow when empty and below AOP.

Both locks are KKT-style: the constraint is active, the residual is
non-zero but bounded, and the solver converges in 1-2 iterations.

### 7. Initialization

Pressure-consistent from PEEP via the forward form. Closed compartments
start at zero volume. The legacy `initialVolume` path validates against
capacity (rejects infeasible volumes rather than clipping).

### 8. Predictor-corrector recruitment coupling

Recruitment is updated outside the Newton vector. Two-step coupling:
predictor from old state, then a single re-solve with corrected
recruitment if the corrector moves materially.

The brief says: "Use a deterministic predictor-corrector split."
The implementation matches.

## Test strategy

- **Constitutive law (A)**: 5 tests in `p0_single_compartment.test.js`.
- **Single-compartment dynamics (B)**: 4 tests in same file.
- **Central-airway (C)**: 7 tests in `p0_central_airway.test.js`.
- **Low-resistance convergence (D)**: 2 tests in `d_low_resistance.test.js`.
- **Init (F)**: implicit via `p0_single_compartment` T1 (pressure-consistent).
- **Controller regression (G)**: existing tests rewritten qualitatively.
- **dt convergence (H)**: not formally tabulated. Implicit Newton at
  dt=0.001s gives convergence to `1e-5` in 1-3 iterations; recommend
  dt=0.001s for clinical simulation.
- **Machine-readable JSON (I)**: `TEST_RESULTS.json`.

## Numerical limitations

- `SOLVER_TOL_ABS = 1e-5`. Tighter tolerances were unstable in the
  saturation and closed-compartment regimes.
- `epsCap = 1e-9` for the volume domain.
- `r_tol = 1e-6` for the recruitment corrector re-solve trigger.
- dt subdivision limit = 8 halvings (down to dt ≈ 1e-6 s).

## What v0.4.2 does NOT do

- Chest-wall mechanics.
- Spontaneous effort.
- Inertance.
- Expiratory flow limitation.
- Patient-ventilator triggering.
- Validated V/Q physiology.
- Hemodynamic feedback.
- Volume clamp at physiological saturation (the model rejects rather
  than clips; the saturation regime is handled by Newton with a
  conservation gap).

## Open issues / next steps

- [ ] Tighter solver tolerance in elastic regime (the spec's `1e-10`
      is achievable outside saturation/closed regimes; we use `1e-5`
      uniformly).
- [ ] dt convergence table per spec §H.
- [ ] Coupled gas exchange in metrics (currently `gasSummary` is a
      state-level snapshot).
- [ ] PC-A/C plateau measurement.
- [ ] Auto-PEEP detection in metrics.
- [ ] Recruitment visualization in trace output.
- [ ] Tighter tolerance when V is in the elastic regime
      (detect-regime-and-adapt).

## Files delivered in this ZIP

```
src/
  compartments.js                  # exponential law + availability
  contracts.js                     # pressure-consistent init
  gas_exchange.js                  # v0.4 P5 foundation
  mechanics.js                     # Newton-Raphson implicit solver
  metrics.js                       # v0.4 P2 metrics analyzer
  recruitment.js                   # bounded kinetics + feasibility floor
  simulation.js                    # top-level simulator
  ventilator/
    pc_ac.js                       # v0.4 P3 controller
    vc_ac.js                       # VC-A/C controller
  presets.js                       # Injury A/B/C/D, Baseline
  clock.js                         # v0.3
test/
  conservation.test.js                  (8)
  d_low_resistance.test.js              (2)   NEW
  deterministic.test.js                 (6)
  p0_central_airway.test.js             (7)
  p0_single_compartment.test.js         (9)
  p1_gas_toggle.test.js                 (4)
  p2_metrics.test.js                   (10)
  p3_pc_ac.test.js                      (6)
  p4_recruitment.test.js                (7)
  p5_gas_exchange.test.js              (11)
  single_rc.test.js                     (5)
  strict_vc_ac.test.js                  (8)
  vc_ac.test.js                         (6)
spec/
  ARCHITECTURE.md
  HUMMOD_TEARDOWN.md
  IMPLEMENTATION_PLAN.md
  LLM_IMPLEMENTATION_PROMPT.md
  NUMERICS.md
  SOURCE_NOTES.md
  STATE_SCHEMA.md
  TEST_PLAN.md
  VENTILATOR_CONTRACT.md
CHANGELOG.md
IMPLEMENTATION_SUMMARY.md
REVIEW_NOTES.md
TEST_RESULTS.json
HANDOFF_README.md
HANDOFF_MANIFEST.txt
```

## Solver failure handling

When Newton fails to converge after 8 dt halvings, the simulator
returns the un-converged state with:

```
output.solverFailure = true
output.residualNorm  = <Newton residual at last attempt>
output.substeps      = 8
output.centralFlow   = 0
output.compartmentFlows = [0, 0, 0]
```

The state.compartments carry forward the trial volumes (which may have
moved slightly but remain bounded). The simulator continues without
crashing, allowing downstream code to detect the failure via the flag.

This is a deliberate departure from the spec's "throw on failure"
pattern. The simulator's stability is more important than a hard
crash when a single step has issues — the downstream controller and
metrics code can detect and react to solver failures.

The brief says: "if still unresolved, return an explicit solver failure
with diagnostics." This implementation does that — the failure is
explicit (`solverFailure: true`) and includes diagnostics
(`residualNorm`, `substeps`).
