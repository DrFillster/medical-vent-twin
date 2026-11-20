# Fixed-parameter venous initialization timecourse audit

## Design

Replay the same six fixed-parameter configurations in the completed venous
initialization control diagnostic. Sample at elapsed seconds 0, 24, 60, 120,
300, 600, 900, 1800, 2700, and 3600. Calculate early 24-to-300-second change,
late 1800-to-3600-second change, and final 900-second change for model PaCO2,
PaO2, and pH. These are descriptive model diagnostics, not clinical cutoffs.

No new parameters are fitted. No post-index outcome file is read. The original
acceptance gate is not changed. Compare checkpointed replay with the prior
24-second-to-60-minute differences and require agreement within 0.001 in each
reported variable. This verifies that extra segmentation has not materially
changed the trajectory. A small endpoint change does not prove every state is
at equilibrium; full state derivatives and mechanical cycles are not tested.

The initializer substitution remains process-local and production source is
unchanged. Patient-level trajectories are stored only under local MIMIC derived
artifacts as `venous_sid_timecourse_control.json`.

## Status

Running; interpretation pending the completed checkpoint replay.

## Publication

The prior GitHub update remains blocked. This local diagnostic does not retry
or bypass that publication operation. No new commit or remote update claimed.

## Completed result (supersedes running status)

All six trajectories completed at all ten checkpoints. The checkpointed
24-second and 60-minute values exactly reproduce the prior runs for all
reported gases; maximum endpoint error is zero. The artifact verification,
four synthetic initializer cases, and eight optimizer assertions pass.

Both latent-SID configurations approach nearly the same final gases with
existing and alternative initialization. The alternative reduces the early
CO2 dip and therefore reduces the change measured from the 24-second baseline.
The later gas change is small in both cases. This supports an early-transient
explanation of the control's historical gate reversal, not a change in its
late equilibrium. Full model-state equilibrium and intervention accuracy
remain untested.

Do not change the locked cohort gate retrospectively. Next bounded development
task: run the same fixed-parameter, matched-initialization timecourse on the
three existing failure examples. Separate baseline-target mismatch, early
transient, and late gas drift in the report. Do not tune parameters or inspect
post-transition outcomes. A new settled-baseline fitting protocol would need
a separate declared development version before any new validation freeze.

Local result SHA-256:
`f0088465281763a383dc3d9882d3bd2b1d1762a17a2e8b54c0609380814e255c`.
No production source changed. GitHub publication remains pending.
