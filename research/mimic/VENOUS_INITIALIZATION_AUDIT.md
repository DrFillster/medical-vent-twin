# Venous initialization sensitivity diagnostic

## Purpose

Isolate one model-initialization assumption after the combined nuisance search
failed to recover the previous passing control under latent SID.

The existing initializer retains the source venous bicarbonate while the gas
conversion uses the supplied SID. This diagnostic instead preserves source
venous PCO2 under a change in SID. Neither option is a measured venous state.
The alternative is a model sensitivity test, not an established correction.

## Method

`diagnose_venous_sid_initialization.js` substitutes the initializer in its own
Node process before loading the live-session module. No production source is
edited and the substitution disappears when the process exits.

Three parameter configurations each receive unchanged/alternative venous
initialization runs for 60 minutes: default SID with original nuisance values;
latent SID with original nuisance values; and latent SID with the previous
paired-search nuisance values. Parameters are not refit within each pair.
Only venous bicarbonate is changed. Arterial gases and venous oxygen content
are asserted unchanged. Source-prior venous PCO2 is round-trip checked, and
the default-SID alternative must reproduce the original trajectory.

Only pre-transition artifacts are read. Patient-level results stay local in
`venous_sid_initialization_control.json`; no outcome data are opened.

## Status

Diagnostic running. Do not infer success from implementation alone.

## Publication status

The previous combined documentation/commit/push command was blocked before
execution. This continuation does not retry or bypass that blocked GitHub
update. Local source and notes remain uncommitted pending an approved path.

## Diagnostic implementation correction

The first attempt stopped at its venous-PCO2 round-trip assertion before any
alternative trajectory ran. The existing GasToBase and BaseToGas mappings use
separately rounded coefficients and are not exact inverses. A direct synthetic
source-state check returned 45.27968 mmHg before and 45.281582 mmHg after the
round trip. That small discrepancy is not evidence for the observed large drift.

The diagnostic now inverts the actual affine BaseToGas mapping on its positive
unclamped branch using two probes. It retains the round-trip assertion and
the default-SID invariance check rather than loosening those checks. This
changes diagnostic initialization only; it does not replace either source
chemistry equation in the runtime.

## Completed checks before final result aggregation

Four synthetic SID cases pass exact source venous-PCO2 preservation and the
unchanged arterial/oxygen-state assertions. Eight optimizer-scoring assertions
also pass. Syntax and diff-whitespace checks pass. No production-source diff
is present. These checks test implementation contracts, not clinical validity.

## Completed result (supersedes running status)

All six 60-minute trajectories completed. Default-SID original and alternative
both passed, with residuals invariant within 0.001. For latent SID, the existing
initialization failed and the alternative passed with either fixed nuisance
configuration. No parameters were retuned between members of a pair.

This isolates an initialization contribution to this control's historical gas
gate failure. It does NOT establish true stationarity or clinical validity.
The gate compares a 24-second baseline with the 60-minute endpoint. Changing
the initial venous state reduces an early transient; the 60-minute pH residual
is effectively unchanged within each latent-SID pair. Remaining CO2 drift is
still near the historical cutoff. There is no evidence here of a repaired
long-term equilibrium or correct intervention response. pH was not a pass gate.

Next bounded task: record multiple pre-intervention timepoints and compare
late-window slopes with the early transient on these same fixed pairs before
scaling to the other failures. Do not promote an early-transient gate rescue
to a stationarity claim or tune against post-transition truth.

Local result SHA-256:
`84b5d613a00b230cf2be4c1c39b081e648c49b04bfe474f79ee04b74b983f4d6`.
The patient-level result remains outside GitHub. No production file changed.
