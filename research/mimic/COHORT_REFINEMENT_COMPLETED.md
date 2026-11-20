# Complete development cohort perfusion refinement

All 14 prior failures completed bounded searches. 140 fresh full-hour model
simulations, zero execution errors. Five newly pass the unchanged historical
gas gate. With five inherited successes, qualification is now 10/19. Nine
remain unresolved: six budget exhausted, three no oxygen-target bracket.
All 140 ledger attempts pass integrity checks. These are development fitting
results, not held-out intervention prediction or clinical validation.

At the closest-final-oxygen candidate for each unresolved case, seven retain
CO2 gate failures and two retain baseline oxygen failures. This is a diagnostic
selection, not an additional optimizer or proof of unique biological cause.
For the two oxygen failures the final oxygen target remains underestimated
at perfusion 1.0 by about 44 and 38 mmHg. Do not extend the fraction above one.
For the seven CO2 failures, distinguish early-state error, drift, and final
CO2 mismatch; refining oxygen alone is not a general solution.

The five new successes retain their finite pH residuals without a new pH gate.
One final pH residual is approximately +0.054, not approximately 0.03. Report
it rather than silently lumping it into the earlier two-example range.

## Confirmation design

Fresh 120-minute replay of all five new successes, unchanged fitted parameters,
no retuning. Sample 24, 900, 1800, 2700, 3600, 5400, 7200 seconds. Replay hour
gases against saved selections; independently report historical hour gate,
descriptive extended gate, final target error and hour-to-two-hour movement.
This is development confirmation only. Runner: confirm_cohort_recovered.js.
PID 55002. Output recovered_120min.jsonl under dev-cohort-perfusion-v1.
Confirmation started; no completed five-case confirmation claim yet.

## Next dependency

Use complete confirmation findings to decide whether to freeze the current
qualification method for a narrowly scoped predictive experiment, while
retaining all nine exclusions/failures explicitly. Do not keep tuning every
example until it passes, or call selected fit success validation. Any further
CO2/initial-state development needs a separate declared design and untouched
validation data. GitHub publication remains pending; production unchanged.
