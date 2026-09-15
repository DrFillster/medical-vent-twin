# CHANGELOG — ARDS Digital Twin v0.4

## v0.4.0 — 2026-09-14

### Summary
v0.4 replaces the v0.3 frozen-recruitment linear RC model with a stateful
dynamic simulator. Recruitment/derecruitment now evolves with alveolar
pressure (hysteresis), the simulator exposes a per-breath metrics layer,
and a Pressure-Control Assist/Control controller is added alongside the
existing Volume-Control controller. Compartmental V/Q gas exchange is
introduced as a foundation module.

### Architectural changes from v0.3

- **Recruitment dynamics** (`src/recruitment.js`, `src/compartments.js`,
  `src/mechanics.js`): each compartment has a recruitment state in
  [0, 1] that evolves via opening/closing thresholds (P_open, P_close)
  and rate constants (k_open, k_close). Effective capacity scales with
  recruitment via `capMult(r) = 1 + r * (fN_max − 1)`. Closing direction
  was initially wired backwards and was caught + fixed (closing decreases r).

- **Metrics analyzer** (`src/metrics.js`): pure function `analyzeAll(trace,
  peep)` emits one record per completed breath — VtInspired, VtExpired,
  RR, MV, Ti, Te, I:E, PEEP, Ppeak, Pplat, driving pressure, Qpeak_insp,
  Qpeak_exp, and per-compartment end-inspiratory / end-expiratory volumes.

- **PC-A/C controller** (`src/ventilator/pc_ac.js`): square-wave pressure
  target (PEEP during EXPIRATION, PEEP + Pinsp during INSPIRATION,
  optional PAUSE). Rejects invalid settings.

- **V/Q gas exchange foundation** (`src/gas_exchange.js`): Hill-equation
  SpO2 from PO2, perfusion-weighted mixed-arterial PaO2, shunt and
  dead-space proxies. Educational approximations — NOT validated
  physiology. See REVIEW_NOTES.md.

- **Boundary contract** (`src/contracts.js`): `makeCompartmentParams`
  now allows `recruitment: { P_open, P_close, k_open, k_close, fN_max }`
  nested tuning object. Defaults preserve v0.3 behavior.

- **Simulation layer** (`src/simulation.js`): tracks NET volume change
  since breath start (not cumulative airway flow). This corrects the
  v0.3 Vt over-count of ~3-4% caused by passive recoil leaking
  delivered gas back out during inspiration.

### New tests (40 total new, 25 v0.3 regression retained)

- `test/strict_vc_ac.test.js` (8) — replaces v0.3 permissive tolerances
  with physiological bounds. Adds paired-resistance and paired-compliance
  tests, plateau window determinism, per-breath conservation, deterministic
  replay.
- `test/p2_metrics.test.js` (10) — verifies per-breath metrics output.
- `test/p3_pc_ac.test.js` (6) — verifies PC-A/C settings validation,
  Paw tracking, decelerating flow, lower-compliance → lower Vt,
  determinism.
- `test/p4_recruitment.test.js` (7) — verifies opening/closing
  hysteresis, dead-band, saturation, capacity multiplier scaling,
  simulation-level P_alv > P_open distinction.
- `test/p5_gas_exchange.test.js` (11) — verifies Hill-equation SpO2,
  FiO2-scaled inspired PO2, shunt/dead-space proxies, mixed-arterial
  PaO2, gas-state evolution, determinism.

### v0.3 regressions

All 25 v0.3 tests (deterministic 6, conservation 8, single_rc 4,
vc_ac 7) still pass after v0.4 changes.

### Test totals

67 tests, all passing as of 2026-09-14:
- conservation: 8
- deterministic: 6
- p2_metrics: 10
- p3_pc_ac: 6
- p4_recruitment: 7
- p5_gas_exchange: 11
- single_rc: 4
- strict_vc_ac: 8
- vc_ac: 7

### Known limitations

- Gas exchange module uses educational approximations, not validated
  physiology. See REVIEW_NOTES.md.
- PC-A/C test T5 (lower compliance → lower Vt) demonstrates qualitative
  effect but does not pin down a quantitative ratio.
- The recruitment simulation test (p4 T6) verifies the MECHANISM
  (higher PEEP raises time-averaged P_alv above P_open), not the
  end-state recruitment value — closed-loop dynamics under coupled
  ventilation make the end-state sensitive to controller settings.
