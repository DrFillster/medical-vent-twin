# Reusable bounded perfusion refiner - development implementation

## Contract

`bounded_perfusion_refiner.js` separates the deterministic search from model
simulation and persistence. Accept finite seed candidates, recompute the
historical coupled gas gate, detect neighboring final-oxygen residual sign
brackets, and bisect the narrowest bracket (lower-bound tie break). No bounds
expansion. Stop at the first coupled-gate pass, no bracket, budget exhaustion,
numerical resolution limit or failed evaluation. Default budget four new
simulations, hard configuration maximum 32. Retain all seeds, attempted
fractions, brackets, errors, candidate residuals and recomputed gate results.

Only passing candidates can be selected. Among them use smallest final oxygen
error, then lower fraction as tie break. pH is finite and reported, not gated.
Seeds are required to be finite, unique, and in [0,1]. A failed or nonfinite
simulation is retained and stops the search; it is never silently skipped.
The oxygen-only bracket heuristic is not a global multivariate optimizer and
may miss a feasible point. No-bracket status is not biological impossibility.
An exact final-O2 root failing another gate has no sign bracket and can stop
without success; this limitation is deliberate and must remain visible.

## Tests

Thirteen synthetic contract tests initially passed, covering early success,
seed success, absent bracket, exhausted budget, simulation error, nonfinite
result, parameter mismatch, CO2 gate rejection, invalid/duplicate seeds,
unchanged pH gate, input nonmutation and multi-iteration bounded search.

## Model regression design

Reuse existing eight-point development sweep seeds for each oxygen-mismatch
case; those seed simulations are not rerun. New refinement candidates receive
fresh full-hour model runs. No case-specific bracket or midpoint is supplied.
Check selected fraction against prior midpoint, hour residual replay, and
retention of every original seed plus evaluated attempt. No new SID or dead-
space fit, no held-out outcomes, no changed historical gate.

## Status

Fresh model regression running. Pure algorithm implemented; general cohort
fitting and validation protocol remain unchanged. No production integration.

## Completed implementation and model regression

Both cases completed fresh refinement runs. Each automatically selected the
previously successful midpoint with one new full-hour evaluation, retaining
eight seed candidates plus the new attempt. Independent tests verified all
coupled baseline/drift errors against prior trajectories, selected fractions,
complete seed logs and recomputed gates. Both replay errors are zero.

Final unit suite: 17 contract tests pass, including root-with-other-gate failure,
resolution limit, hard budget cap and direct-gate nonfinite rejection. The
six-run midpoint sensitivity artifact test also passes. No runtime source diff.

This is a reusable refinement component with a development regression driver,
not a complete cohort fitter or a production integration. The driver reuses
prior seed simulations and a process-local alternative initializer. It does
not yet enforce a general seed-context fingerprint or provide a configurable
cohort/CLI interface. Those integration dependencies must be addressed before
cohort-wide use; do not assume arbitrary saved seeds are interchangeable.

Case 3's prior +0.005 perturbation failure remains retained and Case 1 is not
solved by this component. Candidate-method planning remains separate from
the locked validation protocol. No new held-out outcome access or publication.

Next bounded chunk: integrate this component behind a development-only runner
with explicit input/context fingerprints and configurable paths, then resolve
Case 1 source-consistent initialization before expanding the cohort.

Local result artifact SHA-256: `d1b67db822ca084bda390e6107b74146714bc0b1d013b54700728602ec130c57`.
