# Exact-time explicit-state development replay - 2026-11-21

## Completed

Replayed the three previously selected similar-setting cases with an observed
arterial gas. Six fresh runs: unchanged settings versus recorded FiO2 change.
Runs stop at the actual observed specimen elapsed time, not nearest five-minute
grid. All six complete with finite final gas outputs. One previously qualified
baseline, two previously failed baselines. Failures stay labeled failures.
No parameter retuning, no disease assignment and no independent test-set use.
Selection restricted to available specimens already inspected in development;
not a new blinded sample. Nine-case setting-group manifest remains unchanged.

Research explicit-state options now used for these actual patient replay inputs;
independent stiffness/capacity/resistance expressed at legacy-equivalent values,
with existing gas initialization/parameters. Initial gases exactly equal legacy
adapter. Normalized mechanics agree within relative numeric tolerance 1e-12.
This confirms migration, not improved initialization or distinct disease models.
Reference template and known legacy recruitment behavior deliberately retained.

## Failed first attempt retained

First pass demanded exact deep parameter equality. Reciprocal-multiplication
versus division produced last-bit capacity differences; failed assertions were
retained. Stopped that process before completing all cases. Version 2 documents
strict numeric tolerance for parameter comparison, retains exact initial-gas
checks, and completes six runs. Do not count first-attempt failures as patient
fit failures, or report floating-point equivalence as bitwise identity.

## Observations

Qualified case reproduces the earlier raw gas comparison at exact specimen time.
Both baseline-failed cases show visibly poorer CO2 agreement than the qualified
case. In one failed case, unchanged-settings oxygen endpoint is closer to the
observed oxygen value than the recorded-change endpoint. No blanket improvement
from applying the recorded intervention can be claimed. Paired no-change
simulation is not persistence and must remain a distinct comparator.

Raw case-level values/identifiers remain outside GitHub. No derived medical
score or aggregated accuracy estimate computed. Three development examples
cannot establish comparative effectiveness or clinical validation.

## Intervention context

Audited five setting item types from two hours before transition through each
available blood-gas time (otherwise one hour), for all nine original cases.
No strictly post-transition records differ from expected simulated settings
in this scan. This is NOT proof of stability: missing charting, same-time
cochanges, alternative mode labels and documentation ordering remain limitations.

Selected sedative/opioid/paralytic/vasoactive input-event labels inspected for
the three cases with gases. Two overlapping records found in one case, none
starting strictly after transition. Selected inputevents only, not complete MAR
or dose-history reconciliation; no dose conversions, status records retained.
No causal attribution of gas change to isolated FiO2 adjustment permitted.

## Verification and continuation

Six existing simulation programs and two synthetic source tests pass. Replay
contract verifies all six arms, exact observation elapsed time, finite outputs,
parameter equivalence, and retention of two baseline failures.
Production unchanged. Next compare baseline-failed cases with time-verified
pre-change inputs and independent mechanical controls under a fixed development
search; evaluate baseline qualification before intervention accuracy. Do not
retune to the now-visible outcome gas. Prospective-ready cohort remains separate.
