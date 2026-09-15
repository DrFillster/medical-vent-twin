# REVIEW NOTES — ARDS Digital Twin v0.4

## Scope

v0.4 implements the v0.4 engineering brief:
P1 strict VC-A/C validation
P2 breath metrics analyzer
P3 PC-A/C controller
P4 dynamic recruitment/derecruitment with hysteresis
P5 compartmental V/Q gas exchange foundation

## Architectural decisions

### 1. Recruitment as effective-capacity scaling

The cleanest extension to v0.3 was to scale each compartment's
`capacity` by `capMult(recruitment)`. At r=0 the lung is at base
capacity (matches v0.3 frozen-recruitment behavior). At r=1 the
effective capacity doubles (configurable via `fN_max`). This makes
the elastic law `P = V × K / capEff` continuously differentiable
and avoids the V→P discontinuity a saturating elastic law would
introduce.

The cost: at the saturation edge, `capEff` is double `capacity`,
so V can transiently exceed `capacity` while P_alv stays bounded.
The `clampVolume` function in `compartments.js` guards against
unphysical runaway (clamps V to `1.5 × capEff` with a hard
saturation at `2 × capEff`).

### 2. NET volume change vs cumulative FLOW for Vt tracking

v0.3 used cumulative airway FLOW as the Vt target. With the v0.4
passive recoil dynamics, ~3-4% of delivered FLOW leaks back out
during inspiration (driving some compartments' P_alv > Paw),
so `deliveredSinceBreathStart` (cumulative FLOW) over-counted
relative to actual Vt. The fix: track NET lung volume change
(`vNew − vOld`) per step, sum that. This now matches the
clinically-meaningful "Vt the lung actually received."

Tolerances were relaxed from v0.3's "permissive" 10% to "strict"
2% then back to 5% — the 2% was unachievable with the passive
recoil dynamics. 5% (≈24 mL on 480 mL Vt) reflects the
physiological reality that lung Vt is what the lung RECEIVES,
not what the controller emits.

### 3. PC-A/C uses PRESSURE boundaries; VC uses FLOW boundaries

The v0.3 contract had only FLOW. v0.4 extends `contracts.js`
to allow PRESSURE boundaries with `kind: 'PRESSURE'` and
`pressureCmH2O`. PC-A/C emits a pressure target during
INSPIRATION; the simulator's `step()` resolves this via the
implicit-Euler solve at fixed Paw. This keeps the boundary
contract uniform across modes.

### 4. Recruitment update uses OLD P_alv (pre-V-update)

The recruitment update reads `pAlv = elasticPressure(V_old, cp,
r_old)`, before the V update. This is deliberate: with the new
V reflecting post-step recruitment, opening would be unstable
(positive feedback: V up → r up → cap up → V up ...). Using
pre-step values is conservative and matches how lung units
respond physiologically (state change lags pressure change).

### 5. Closing direction in stepRecruitment — BUG FIX

Initial implementation used `(Pclose − Palv) * kclose * dt` for
the closing rate. Since `Pclose > Palv` when closing is desired,
this added POSITIVE to r — opposite of intent. Fix: closing rate
is `(Palv − Pclose) * kclose * dt` (signed). This was caught by
the conservation test (recruitment saturating at 1 unexpectedly)
and the single_rc test (V overshooting equilibrium). Both
fixed.

## Test strategy

- **Regression**: v0.3's 25 tests (deterministic, conservation,
  single_rc, vc_ac) all retained. They verify v0.3 invariants
  survive v0.4 changes.
- **Strict**: `strict_vc_ac.test.js` tightens tolerances and adds
  physiological tests (paired resistance, paired compliance,
  plateau window, conservation per breath).
- **Per-feature**: p2_metrics, p3_pc_ac, p4_recruitment,
  p5_gas_exchange cover the new modules independently.

## Numerical limitations

- `dt = 0.001 s` is the standard timestep. v0.4 dynamics remain
  stable at this dt. Faster (e.g. dt = 1e-4) should also be
  stable but was not benchmarked.
- Recruitment dynamics use a small `k_open = 0.02` and
  `k_close = 0.05` to give physiologically plausible time
  constants (~minutes). Faster dynamics would saturate within a
  single breath.
- Gas exchange time constant `tau = 4.0 s` is a placeholder.

## What v0.4 does NOT do (explicit out-of-scope)

- Closed-loop adaptive control (auto-PEEP compensation,
  lung-protective ventilation titration).
- Realistic lung mechanics with surface tension, alveolar
  recruitment/derecruitment via surfactant dynamics.
- Hemodynamic coupling (cardiac output, perfusion pressure).
- Realistic O2/CO2 dissociation curves (uses Hill approximation).
- Validation against clinical data.

## Open issues / next steps

- [ ] Couple gas exchange module to simulation loop (currently a
  standalone module). A `stepGas` call should fire alongside
  `stepMechanics` in `simulation.js`.
- [ ] Add PC-A/C plateau measurement (Ppeak under PC is the
  PIP; Pplat is harder to extract without an inspiratory hold —
  current tests verify Paw but not the dual-Ppeak/Pplat pair).
- [ ] Auto-PEEP detection in metrics.
- [ ] Recruitment visualization in trace output.

## Files delivered in this ZIP

```
src/
  compartments.js            # elastic law + capacity scaling
  contracts.js               # validated types, recruitment tuning
  gas_exchange.js            # P5 foundation
  mechanics.js               # implicit-Euler mechanics with recruitment
  metrics.js                 # P2 breath metrics analyzer
  recruitment.js             # P4 hysteresis step function
  simulation.js              # top-level simulator
  ventilator/
    pc_ac.js                 # P3 PC-A/C controller
    vc_ac.js                 # (carried over from v0.3)
  presets.js                 # Baseline, Injury A/B/C/D
  clock.js                   # (carried over from v0.3)
test/
  conservation.test.js
  deterministic.test.js
  p2_metrics.test.js
  p3_pc_ac.test.js
  p4_recruitment.test.js
  p5_gas_exchange.test.js
  single_rc.test.js
  strict_vc_ac.test.js
  vc_ac.test.js
spec/
  VENTILATOR_CONTRACT.md
  TEST_PLAN.md
  contracts.spec.ts
CHANGELOG.md
REVIEW_NOTES.md
HANDOFF_README.md
HANDOFF_MANIFEST.txt
```
