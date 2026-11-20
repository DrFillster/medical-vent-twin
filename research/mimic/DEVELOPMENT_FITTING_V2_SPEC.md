# Development fitting v2 - candidate specification, not active protocol

Status: planning only. Does not replace the existing locked cohort protocol.
Scope: the previously examined pre-transition development examples only.

## Problems isolated so far

The initial venous-state assumption can change an early-to-final stability
gate without changing the late gas equilibrium. A coarse perfusion grid can
skip a target crossing. Neither finding justifies adding unsupported patient
measurements, new physiology, or wider parameter bounds.

## Candidate method requirements

1. Preserve original fits, exclusions and historical gate results unchanged.
2. Label latent SID and dead-space/perfusion nuisance values as unmeasured
   fitted parameters, not identified disease traits or measured dead space.
3. Evaluate early target fit, early transient, late gas change and late target
   fit separately. Do not choose a settling time after viewing held-out errors.
4. If a perfusion grid brackets an oxygen target, allow bounded, traceable
   refinement. Recheck CO2 after each oxygenation change because they are coupled.
5. Keep pH residual in the report. Do not add model complexity solely to remove
   the approximately 0.03 development residual or silently introduce a pH gate.
6. Replay successful candidates at an extended horizon and perturb parameters
   under a declared local sensitivity design. A narrow passing region must be
   reported, not hidden by selecting the best candidate.
7. Case 1 remains a separate initialization problem. Do not discard it because
   other examples now pass. Do not turn an arbitrary warmup into a solution.
8. Freeze method, initialization, objective, horizon, stopping rule and
   acceptance criteria before any new validation cohort/outcome access.

## Not yet authorized by this specification

No production change, new validation claim, cohort-wide refit, new cutoff,
new patient measurement, or causal interpretation of a nuisance parameter.
A general refined fitter is not implemented or validated by these diagnostics.

## Decision dependency

Complete midpoint extended/local-sensitivity results first. Use them to decide
whether to implement a bounded general search or first resolve acceptance-gate
fragility. No automatic tuning to make every development example pass.
