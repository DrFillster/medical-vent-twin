# Existing development failure timecourses

## Fixed design

Replay the three previously failed development examples using their existing
latent SID and nuisance parameters from `acid_base_joint_smoke_4.json`. For
each example compare unchanged initialization with source-venous-PCO2-preserving
initialization at ten checkpoints through 3600 seconds. No parameter is refit.

Report 24-second target residuals, 60-minute target residuals, early-to-final
change, 30-to-60-minute change, and final-15-minute change separately. Preserve
the historical gate and show each failed component. pH remains a diagnostic,
not a silently added gate. Require original-init trajectories to reproduce the
previous failure residuals within 0.001 before interpreting a comparison.

Only pre-transition fits are read. Post-index outcomes remain unopened.
Patient-level output stays local in `venous_sid_failure_timecourses.json`.
No production source is changed. No GitHub publication is claimed.

## Status

Six trajectories running. No success claim before replay checks complete.

## Completed result (supersedes running status)

Six trajectories completed. All three original failure residuals reproduce
exactly (maximum replay error zero). Paired parameter equality, finite
checkpoints, and unchanged-gate artifact checks pass. The three failures
remain failures under both initializations. No cohort rescue is supported.

Case ordering follows the existing three-example development artifact.
Case 1 fails baseline CO2 and early-to-final CO2 change under both options,
but its final gases are close to the measured pre-transition targets. This
is primarily an early-transient/initial-state problem in this diagnostic.
Cases 2 and 3 retain substantial final oxygen-target mismatch under both
initializations; case 3 also fails the oxygen-change component. A small late
slope is not a successful fit when the final oxygen level is wrong.

Do not extend the passing-control initialization result to these failures.
Do not drop failures or relax the historical gate. Separate the following
next development tasks: (1) assess source-consistent gas-state initialization
for case 1 without inventing venous measurements; (2) test oxygenation model
capacity across the already allowed ventilated-perfusion grid for cases 2/3,
with existing CO2 and SID held fixed, before adding parameters or mechanisms.
That grid would test the selected fitting method, not prove biological
impossibility if it fails. No held-out outcomes should be used.

Checks rerun: four synthetic initialization cases, eight optimizer scoring
assertions, six-control-trajectory artifact integrity, syntax, and whitespace.
Production source diff remains empty. GitHub publication remains pending.

Local result artifact SHA-256:
`6d9bdab858a8e02490c1524096e62e59f4b5422bff90525ae20db8081a0b17ab`.
Patient-level output remains outside GitHub.
