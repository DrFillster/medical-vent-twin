# Startup calibration and delivered-ventilation gas research composition

2026-10-29. Experimental, passive and leak-free domain only. The live systemic
session, native HumMod runtime, UI and deployed assets are unchanged.

## Startup and transient behavior

Dräger's *AutoFlow* booklet section 3, printed p. 8 (PDF p. 8), describes a
flow-controlled initial breath and subsequent pressure control using its
end-inspiratory pressure. The research AutoFlow profile now begins with such a
flow calibration rather than an assumed initial pressure. A caller supplies
`calibrationPauseSec` explicitly. The experimental benchmark uses 0.1 seconds
within the specified inspiration time to let zero-flow pressure settle. That
pause is an **engineering extension**, not an assertion about Dräger firmware.
Setting it to zero runs the unpaused calibration and can produce a second-breath
overshoot; it must not be silently treated as equivalent.

For the calibration breath:

```
flow duration = inspiratoryTime - calibrationPauseSec
requested flow = min(target VT / flow duration, remaining target volume / dt)
requested flow = 0 during the calibration pause
next driving pressure = clip(measured end-inspiratory Paw - PEEP,
                             minimum driving pressure, maximum Paw - PEEP)
```

VT emerges from the mechanics. If the FLOW request would exceed maximum Paw,
Simulation re-solves the same uncommitted state with a PRESSURE boundary at the
cap. It does not clip the lung volume or force achievement of the target. The
flow's time/volume budget only applies to calibration; later adaptive pressure
breaths retain their usual time cycling. Failure of either mechanics solve
rolls back controller state and does not commit lung volume, time or feedback.

The APV research profile starts at its configured minimum driving pressure and
adapts upward. This is a disclosed low-pressure engineering probe, not a complete
reproduction of Hamilton initialization. `startupStrategy:'provided-pressure'`
retains the previous behavior for comparison. It does not erase the earlier
overshoot finding. `targetExceeded` makes above-tolerance breaths visible.

The existing perturbation and mode-switch paths preserve one persistent lung.
New controllers recalibrate at the next completed-breath boundary. Independent
device validation is still needed for startup, effort, trigger synchrony,
pressure ramps, leaks and abrupt changes in mechanics.

Primary reference:
https://www.draeger.com/Content/Documents/Products/autoflow-bk-9066357-en.pdf
Other mode references and the disclosed adaptive gain equation remain in
`ADAPTIVE_VOLUME_MODES.md`.

## Delivered measurement and gas interface

`DeliveredBreathSampler` observes only successful committed mechanics steps.
It records maximum net lung-volume increase during inspiration, in liters,
and onset-to-onset cycle duration, in seconds. Under the explicitly passive,
leak-free assumption this is the delivered inspired lung volume; it is not a
claim about every ventilator's sensor algorithm or physiological dead space.

```
actual respiratory rate = 60 / measured cycle duration
measured tidal volume in mL = measured inspired lung volume in L * 1000
```

The sample becomes available only at the next breath onset. It therefore carries
one completed-cycle lag, with an additional numerical update interval of 0.1 s
in the trial. Missing, contaminated or stale samples fail closed. A caller sets
`maxSampleAgeSec` explicitly. There is no fallback to target VT, set RR, or a
previous valid sample after a contaminated cycle is completed.

`createLiveCoreBoundaryFromVent` has a new **explicit research-only** measured
boundary argument; its legacy VC path is unchanged and was checked for exact
boundary parity with the pre-change adapter. The measured branch accepts only
supported modes and validates cycle units, timestamps, freshness, rate-period
consistency, passive/leak-free assumptions, positive volume, and explicit dead
space. Samples are observational reductions from the Vent mechanics, not a new
physiological gain. Anatomical/physiological dead space is not inferred from the
mode or the lone demo pair.

`createResearchDeliveredGasSession` composes those measurements with the existing
`createHumModArdsGasRuntime`. Gas/acid-base equations are unchanged. Vent's own
parallel gas approximation must be disabled (`trackGas:false`) so only the
reduced gas runtime owns gases. The caller supplies metabolism, perfusion,
membrane permeability, dead space, SID, oxygen capacity, temperature, ambient
pressure, and an initial gas state (or explicit opt-in to HumMod source defaults).

The gas runtime retains its existing BTPS→STPD conversion, dead-space subtraction,
CO2/O2 balance solves, blood-pool delays and pH chemistry. Exact source locations
and unit provenance are in `hummod_ards_core_breathing.js`,
`hummod_ards_core_gas_exchange.js`, `hummod_ards_core_runtime.js`, and
`hummod_ards_core_chemistry.js`. This change does not insert a new PaCO2 formula,
fit to a patient's post-change ABG, or average competing physiology owners.

The isolated trial uses fixed perfusion/metabolism; integrated cardiovascular,
metabolic and autonomic responses are **not** validated by it. It does not
support holds during gas advancement, apnea/zero delivered VT, spontaneous
effort or leaks. Holds are rejected before either clock advances. Source-model
limits (including the previously documented severe-hypoxia venous-O2 failure)
remain and are not fixed or hidden here. Failed coupling sessions cannot be
resumed as if the failed interval had advanced.

## Reproduction

From `ards-twin-v1.0`:

```
node test/adaptive_startup_gas.test.js
node test/adaptive_volume_modes.test.js
node scripts/adaptive-startup-gas-trial.js /absolute/path/gas-trial.json
```

The scripted trial is a synthetic baseline lung, RR 15/min, PEEP 5 cmH2O,
FiO2 0.4, and VT stages 450→600 mL, pressure limitation, recovery, then 300 mL.
It uses 0.002-second mechanical steps and 0.1-second gas updates. Each gas stage
lasts 120 seconds. Endpoints are finite-time model outputs, not asserted
steady states, clinical accuracy or vendor validation.

An additional 48-case mechanics envelope varies both mode profiles, three
synthetic phenotypes, RR 15/30, Ti 0.6/1.0 s and PEEP 5/12. The task artifact
contains exact settings, source hashes, checkpoints, results and reproducible
scripts. The full MIMIC-IV v3.1 transition audit and held-out patient validation
remain dependent on access/data availability; no cohort result is inferred from
these synthetic checks.
