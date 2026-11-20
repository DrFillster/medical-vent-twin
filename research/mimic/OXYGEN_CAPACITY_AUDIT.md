# Fixed-SID / fixed-CO2 oxygenation capacity audit

## Declared design

Two existing oxygen-mismatch development cases, eight existing ventilated
perfusion candidates each. All 16 receive a full 60-minute trajectory, with
source venous PCO2 preserved at initialization. Keep the existing fitted SID,
CO2 nuisance, mechanics, patient effort, FiO2, PEEP and pressure support fixed.
Sample at 0, 24, 300, 900, 1800, 2700 and 3600 seconds.

Report early and final target error, early-to-final drift, late drift and the
unchanged historical gate separately. Verify prior selected candidates against
saved failure trajectories. A final oxygen match alone is not a full gas-gate
pass. A failed finite grid does not prove that the model can never fit a case.
Do not use held-out outcomes or expand parameter bounds.

Follow-up after the sweep: inspect the best final-oxygen candidate's model
boundaries and oxygen exchange to identify a specific limitation or fitting
tradeoff before adding a mechanism. The follow-up will not claim patient-level
physiological identification from these sparse development measurements.

## Status

Sweep running. Patient-level artifacts remain local. Production and the
locked validation protocol are unchanged. GitHub publication remains pending.

## Follow-up design prepared before inspecting results

Select the candidate with the smallest absolute 60-minute oxygen-target error
for each case, then independently replay it through 120 minutes. This is an
oxygen-only selection, not a full-gas optimizer. Verify its 60-minute endpoint
against the sweep and verify that the requested perfusion override is applied.
Record model alveolar and capillary oxygen, uptake, shunt diagnostics,
hemodynamics and mechanics. Inspect late movement versus persistent target
mismatch. No new parameter is introduced and no post-index outcome is read.
The extension must not be represented as an intervention-validation result.

Parameter naming caveat: `co2` in these research scripts is passed to
`patientDeadSpaceFractionOfTidalVolume`. It is a model nuisance input, not a
measured dead-space fraction and not itself an elimination-efficiency estimate.
Preserve this distinction when interpreting the sensitivity sweep.

## Sweep completed and bounded refinement declared

All 16 full-hour grid candidates failed the historical gate. Both prior
selected candidates replayed correctly and the grid/fixed-input artifact test
passed. Oxygen-target error changes sign between neighboring grid candidates
for each case: this is not evidence of exhausted oxygenation model capacity.
The steep target crossing makes coarse parameter spacing a concrete fitting
limitation. No discontinuity or continuity is inferred solely from endpoints.

Add exactly one bracket midpoint per case, computed from the two neighboring
candidate fractions with opposite final oxygen residual signs. Keep SID,
dead-space nuisance, mechanics, effort, ventilation and initialization fixed.
Run each midpoint 60 minutes and report both target residuals and unchanged
historical gate. This is in-bounds DEVELOPMENT refinement, not the unchanged
original grid or held-out validation. No iterative optimization is performed.
The separate best-original-candidate 120-minute checks remain unchanged.

## Completed result (supersedes running status)

All 16 full-hour original-grid candidates completed, zero historical-gate
passes. Both prior selected-candidate endpoint replays passed. Two independent
120-minute best-original-grid replays reproduced the hour endpoints exactly;
the oxygen-target mismatch persisted. Merely waiting longer is not a rescue
for these candidates. Alveolar/capillary oxygen diagnostics remain available
in the local artifact; no diffusion mechanism failure is established here.

Both single bracket-midpoint candidates completed and PASSED the unchanged
60-minute historical gas gate. Only the ventilated-perfusion input changed
within the existing bounds. SID, dead-space nuisance, mechanics and effort
were held fixed. This demonstrates a coarse-grid fitting limitation in these
two development cases, not an exhausted model oxygenation range.

Important limits: the midpoint protocol is newly declared development
refinement. These are previously examined examples, not independent validation.
The original failing results remain retained. pH residuals remain nonzero and
are not included in the historical gas gate. One midpoint remains close to the
CO2 drift cutoff. The midpoints have NOT received 120-minute confirmation;
the extended tests applied to the original coarse-grid choices only. No
robustness or intervention-prediction claim is supported yet.

Tests passed: original-grid coverage/fixed parameters/finite outputs/gate;
two extended candidate replay and applied-perfusion checks; two midpoint
bracket/fixed-input/finite-state/gate checks; previous initializer/scoring/
trajectory artifacts; fresh live-session suite 17 passed, zero failed.
Production source diff remains empty. No held-out outcomes were opened.

Next bounded chunk: fresh 120-minute midpoint replay and small local parameter
perturbations to test pass fragility. Keep case 1 initialization as a separate
problem. If development findings persist, specify a versioned settled-baseline
fitting method with an explicit pH assessment before any fresh validation.
Do not silently alter the locked cohort protocol or merge to production.

## Local artifact integrity

`oxygen_capacity_fixed_sid_co2.json`: `20530725258f8b31d20f84dd9e25bc8354485edb1053e23501edfa051530438e`.

`oxygen_capacity_best_extended.json`: `ee180ba9c9363bd79971e7c9cff2e0d2eb53919e6067368388dce16d7a381974`.

`oxygen_capacity_bracket_midpoints.json`: `c1a10a124b71ce33849385e9e42702ad25a8cc990f0fd78e095d6e5919ae9a3e`.

