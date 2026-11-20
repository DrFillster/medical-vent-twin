# Successful midpoint confirmation and local sensitivity

## Declared design

Two successful development midpoints, each replayed through 7200 seconds at
the exact fitted perfusion input and at absolute offsets -0.005 and +0.005.
These are engineering sensitivity perturbations, not measurement uncertainty
or a physiological confidence interval. All six runs preserve SID, dead-space
nuisance, mechanics, effort, ventilation and alternative initialization.
No retuning or outcome data are used. All values stay in the existing brackets.

Check unchanged historical hour-gate and separately describe the same gas
limits extended to 120 minutes; the latter is not a locked validation test.
Record final target residuals and hour-to-two-hour changes. Verify exact-center
hour endpoint replay against the saved midpoint fit. Check finite gases and
actual applied perfusion at every checkpoint.

pH residual is reported, not used as a new pass criterion. The user's accepted
development decision is not to add complexity solely to remove approximately
0.03 pH error; this does not assert universal clinical equivalence or alter the
locked protocol. No additional acid-base fitting will be done in this chunk.

## Status

Six extended trajectories running. No production source changes or GitHub
publication. Local artifact: `oxygen_midpoint_robustness.json`.

## Interpretation rules

Do not equate the historical gate with final-target accuracy. It limits early
target error and early-to-final drift separately; it does not directly impose
the same absolute target-error limit at the final time. Report final errors
alongside pass status. Passing these perfusion perturbations would demonstrate
only local one-parameter robustness, not robustness to SID, effort, mechanics,
measurement error, alternative initial states, or an intervention.

The prior suite of seven synthetic/artifact test scripts was rerun in this
chunk and passed. Runtime/source diff is empty. The fresh session regression
suite from the immediately preceding chunk passed 17 tests; it is not claimed
as a newly rerun full suite here.

## Completed result (supersedes running status)

Six 120-minute trajectories completed. Both exact midpoints replay their
hour endpoints exactly and pass the historical hour gate and its descriptive
two-hour extension. Five of six total perturbation runs pass both checks.
Case 2 passes at center and both offsets. Case 3 passes at center and -0.005;
+0.005 fails only the early baseline oxygen component. That run remains within
20 mmHg of the oxygen target at two hours. This is early-gate sensitivity,
not late runaway. Do not hide it by dropping the perturbation or changing the
gate after the result. Keep it distinct from final-target accuracy.

All trajectories remain finite. The exact midpoint hour-to-two-hour oxygen
change is small and their final oxygen-target errors are small. pH remains
reported without a new exclusion or fitting step. Only perfusion sensitivity
was tested; no robustness claim for other inputs or interventions is supported.

Independent artifact tests for all six runs pass: fixed inputs, declared
perturbations, endpoint replay, finite/applied state, recomputed target errors,
late differences and both gates. Prior seven synthetic/artifact scripts pass.
No production changes and no held-out outcome access.

Next development implementation: a reusable bounded bracket-refinement fitter
that retains all attempts and rechecks coupled CO2/gas gates, rather than
case-specific midpoint scripts. Use the two examples as development regressions;
retain case 3 perturbation failure as a sensitivity test, not a forced pass.
Keep case 1 initialization unresolved and preserve the locked protocol.

Local artifact SHA-256:
`16918926e0a98a44cae2fe5138d34ab2b9711f0e61a98854116ec90e40e3e8a0`.
Publication remains pending the prior blocked GitHub update.
