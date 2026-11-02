# Passive adaptive volume-targeted ventilation candidate

2026-10-29. **Research-only implementation, not active clinical/device authority.**

## What changed

The Vent mechanics model now accepts the observed labels `CMV/ASSIST`,
`CMV/ASSIST/AutoFlow`, and `APV (cmv)` through the clinical session controller
factory. Conventional CMV/ASSIST maps to the existing fixed-flow `VC_AC` controller.
The adaptive labels map to distinct `VC_AC_AUTOFLOW` and `APV_CMV` research profiles.
Bare `CMV` is rejected because it does not identify a control variable/vendor.
CPAP/PSV, spontaneous, NIV and SIMV modes are not silently mapped to these modes.

The passive adaptive controller commands inspiratory pressure during a specified
inspiratory time and PEEP during expiration. Flow and delivered volume emerge
from the existing three-compartment lung mechanics. It adjusts pressure between
completed breaths toward a set VT. No target volume is injected into the lung.
Pressure is bounded; unreachable VT remains low and is reported explicitly.
Mode switches preserve the persistent lung state, time, recruitment and trace.

This work changes model source and tests only. No UI, build assets, HumMod runtime,
physiology equations, deployment, or running service was changed. The session
used here is the existing **fixed systemic replay** composition: it does not
predict ABG changes after ventilator changes. The default live systemic session continues to reject adaptive modes. An isolated
research composition now connects measured completed-breath VT and actual cycle
rate to the existing reduced gas runtime through an explicit opt-in adapter.
It is not enabled in the running systemic session; see
`ADAPTIVE_STARTUP_DELIVERED_GAS.md`. The raw coupling snapshot preserves adaptive mode identity so
those guards cannot mistake an adaptive target VT for delivered VT.

## Source behavior versus engineering assumptions

Manufacturer sources establish the operating concept, not a complete reproducible
firmware algorithm:

- Dräger, *AutoFlow*, section 1, printed pp. 6–7 / PDF p. 6: pressure/flow adaptation
  and decelerating inspiratory flow. Section 3, printed p. 8 / PDF p. 8: the startup
  flow breath, previous inspired-volume feedback, maximum ±3 mbar per breath,
  pressure cap depending on device configuration, and VT-low notification.
  https://www.draeger.com/Content/Documents/Products/autoflow-bk-9066357-en.pdf
- Hamilton, *Compare ventilation modes*, APVcmv/(S)CMV+ explanation: pressure is
  adjusted between breaths toward VT; pressure cap is high-pressure alarm minus
  10 cmH2O (excluding sigh breaths).
  https://www.hamilton-medical.com/en/Products/Compare/Compare-ventilation-modes.html
- Hamilton G5/S1 manual SW 2.9x, section 7.3, printed p. 127: minimum inspiratory
  pressure above PEEP is 3 cmH2O. This is a referenced research profile constraint,
  not proof of the exact device/firmware used by a MIMIC patient.
  https://www.hamilton-medical.com/dam/jcr%3A5ad7a607-899e-46fb-8c80-6ac9fb563d8f/HAMILTON-G5_ops-manual_v2.9x_en_10149661.01.pdf

The implemented pressure-update law in `AdaptiveVolumeController._completeBreath`
is an **engineering surrogate** inferred from local proportional volume/pressure
behavior, not a published vendor equation:

```
relative volume error = (target VT - measured VT) / target VT
raw pressure correction = gain * current deltaP * (target VT / measured VT - 1)
next deltaP = clip(current deltaP + clip(correction, -step, +step),
                  minimum deltaP, maximum absolute Paw - PEEP)
```

Inside an explicitly supplied volume tolerance, correction is zero. Missing/zero
volume feedback or a hold/PEEP-contaminated breath does not drive adaptation.
Measured VT is the maximum net lung-volume increase from inspiratory onset during
successfully committed inspiration samples (liters). This passive, leak-free
measurement is not claimed to reproduce every ventilator's sensor measurement.
The pressure/volume estimator does not account explicitly for auto-PEEP; the lung
mechanics still produce trapping when present.

All gains/tolerances and pressure limits are explicit caller inputs; none were
fitted to the one demo VT transition. The AutoFlow-profile step cannot exceed
3 mbar, converted using 1 cmH2O = 98.0665 Pa. The APV-profile minimum is ≥3 cmH2O
and absolute maximum Paw must be ≤alarm−10 cmH2O; its adaptation step is an
explicit engineering input because the exact vendor step algorithm is unknown.

Startup now uses flow calibration for the AutoFlow research profile or a
low-pressure probe for the APV research profile. The calibration pause is an
explicit engineering input, not claimed vendor firmware behavior. The optional
`provided-pressure` strategy retains the earlier benchmark for comparison. It
does not emulate proprietary averaging, pressure ramp,
patient triggering, respiratory effort, spontaneous breathing throughout the
cycle, leaks, disconnection compensation, or sigh breaths. Both modes can allow
patient-triggered activity on real devices; choosing a mode never establishes
passivity. Construction requires both `researchOnly: true` and `passive: true`.

Per the digital-twin governing principles, this candidate remains research-only
until vendor bench traces or equivalent primary-source behavior can be reproduced
and independent data validate delivered VT, pressure, timing and gas coupling.
No clinical/device equivalence or validation from one ABG pair is claimed.

## API example

`createBerlinClinicalTwinSession` / `requestVentilationChange` accept:

```js
const ventilation = {
  mode: 'CMV/ASSIST/AutoFlow', // alternatively: 'APV (cmv)'
  researchOnly: true,
  passive: true, // scenario assumption; cannot be inferred from a chart label
  fio2: 0.4, peep: 5, rr: 15,
  vtL: 0.45,
  inspiratoryTimeSec: 1,
  calibrationPauseSec: 0.1, // explicit research settling pause; required for flow calibration
  initialPinspCmH2O: 8,
  minPinspCmH2O: 3,
  maxAirwayPressureCmH2O: 35,
  maxPressureStepCmH2O: 3,
  adaptationGain: 0.5,
  volumeToleranceFraction: 0.02,
  // Required for APV profile:
  // highPressureAlarmCmH2O: 45,
};
```

These numbers are synthetic test settings, not treatment recommendations.
Missing Ti, initial pressure or limits must not be guessed from RR/VT alone in
MIMIC. Snapshot `ventilator.vtL` is the set target; actual previous delivered VT is
`ventilator.adaptive.lastBreath.deliveredVtL`. Actual applied/next inspiratory
pressures, limit shortfall, feedback validity and authority are also recorded.
Controller-level settings use `vt`, `inspiratoryTime`, `initialPinsp`, `minPinsp`,
`maxAirwayPressure`, `maxPressureStep`, and `highPressureAlarm` with L/s/cmH2O units
as indicated by the session adapter above.

## Verification and handoff

Run from `ards-twin-v1.0`:

```
node test/adaptive_volume_modes.test.js
```

Checks cover exact mode mapping, required research/passive assumptions, finite
settings, pressure bounds, delivered-VT convergence, decelerating flow, VT target
changes, stiffer lungs, increased resistance, timestep refinement, heterogeneous
lungs, state-preserving mode switches, hold/PEEP-contaminated feedback, rollback
on a failed mechanical solve, and clinical-session snapshot integration.
Existing VC/PC, hold, conservation, determinism and session regressions are also
run. See the task's saved test report for actual results and any baseline failures.

The demo audit remains separate and unchanged. It established zero conventional
VC ABG pairs and only one adaptive-mode passivity-compatible VT pair. It supports
studying these modes, not relaxing passivity or calling adaptive VT a fixed
volume. Next: validate controller behavior against independent device bench traces and
validate the isolated observed-delivered-volume/actual-RR gas composition.
No production physiology authority is transferred by these research additions.
