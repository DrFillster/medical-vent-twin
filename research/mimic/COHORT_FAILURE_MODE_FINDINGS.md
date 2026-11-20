# Full-cohort failure-mode findings

## Completed diagnostic partition

All 19 candidate baseline trajectories were audited, with no outcome access.
Historical gate passes: five. Historical failures: 14. Among those failures,
four finish within absolute error comparators of 8 mmHg CO2 and 20 mmHg O2,
six retain oxygen-target mismatch, and four retain CO2-target mismatch.
No final-both-gas mismatch occurs under those descriptive comparators.

These final-error comparator values reuse existing component magnitudes for
diagnostic grouping ONLY. This is not a new pass rule, changed gate or claim
of clinical equivalence. All 14 remain historical failures. The four endpoint-
matching failures demonstrate that an early-to-final difference can reject a
trajectory even when the final value fits. The six oxygen and four CO2 endpoint
mismatches must not be explained away as harmless early transients.

Independent checks verify complete/disjoint cohort partition and preservation
of historical failure classifications. Full patient-level diagnostic output
is stored outside GitHub in the baseline batch folder.

## Completed bounded-search evidence

The first failed case completed eight grid and four refinement runs. Its best
final-oxygen bracket refinement approaches the measured oxygen target, but
all 12 candidates fail early CO2 and CO2 drift. This confirms that this allowed
perfusion search does not remove that case's early CO2 failure. It is not proof
that no other initialization or allowable nuisance fit could work.

The second case also completed 12 candidates with no pass. The broader batch
remains active. Do not present a partial search as a complete cohort rescue
rate. Five parent passes are inherited, not newly simulated successes.

## Actionable implication

Do not add physiology merely because the historical gate fails. Keep early
state consistency, final gas-target fit and late stability separate in reports.
Finish the declared perfusion batch before choosing further fitting changes.
If CO2 failures persist, explicitly test initialization versus dead-space fit
under one frozen development design. Do not optimize repeatedly on outcomes.

No revised acceptance criterion is adopted here. Production and locked
validation remain unchanged. Publication remains blocked as previously noted.

## First four completed failure searches

Four originally failed cases now have complete searches, with 40 new full-hour
simulations: 12 + 12 + 8 + 8. One recovers at perfusion 0.7 under unchanged
historical criteria; two exhaust their four-refinement budgets with persistent
CO2 gate failures; one has no final-oxygen target bracket anywhere on the
existing eight-point grid at the fixed SID/dead-space values. All remain in
the denominator. Two baseline passing cases have also been encountered and
inherited unchanged. Remaining cases are still running; no complete cohort
refinement rate is available.

Recovered case final CO2 error is +3.23 mmHg, final oxygen error +11.95 mmHg,
and pH residual -0.0266. CO2 early-to-hour change is +7.72 mmHg, below but near
the unchanged 8 mmHg limit. Do not call that a robust margin or claim a fresh
120-minute confirmation. Perfusion alone recovered the recorded gate here.

The no-bracket case still underestimates final oxygen even at fraction 1.0.
That is evidence against this finite one-parameter search at the fixed other
inputs, NOT proof that adding new physiology or increasing a physical fraction
above one is appropriate. Earlier two-case successful midpoint experiments
used their own fitted nuisance contexts; those results cannot be transplanted
to this cohort batch with a different fixed dead-space fit.

Completion auditor/report process PID 12293 waits for batch PID 11055 then
checks the ledger and refuses to produce a final report unless all 19 case
decisions exist. It does not launch additional fitting or alter the protocol.
