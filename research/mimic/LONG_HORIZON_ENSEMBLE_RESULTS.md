# Long-horizon mechanical ensemble selection - 2026-11-21

## Design

31 retained configurations in three provisionally source-context-matched cases.
Previous case-specific gas fractions and fitted SID fixed; reference metabolism
unchanged. No new parameter bounds or thresholds. Each alternative is simulated
for 600 seconds, not ranked after only 60 seconds. Ranking uses worst recorded
O2/CO2/pH optimization objective over minutes five through ten. The pH weight
(.05 normalization) is not a new clinical acceptance threshold. Only candidates
meeting the unchanged terminal mechanical screen are ranked. This does not
check continuous multi-breath mechanical agreement at every checkpoint.

One winner per case then receives a fresh 1800-second replay, parameters fixed.
All other candidates/failures remain in the ledger. Original ensembles retained.
Source hash of the new runner and concrete input hashes recorded before dynamic
runs. Source dependencies not fully prospectively frozen; production unchanged.
No post-change outcomes used. Fourth case remains withheld for source context.

## Interpretation limits

This compares mechanical alternatives at fixed case gas parameters; it is not
a joint search over the full mechanics/gas/SID space. Even no recovery would
not establish structural inability to represent the case. Worst-checkpoint
objective is an engineering selection measure, not a validated clinical score,
stationarity criterion, confidence interval or independent prediction accuracy.
Initial pH match is constructed and is not counted as baseline qualification.
Reference recruitment/circulation and actual clinical steady exposure remain
unresolved. Do not add these cases to the earlier 10/19 baseline count.

Metabolic code-path dimensional review is separately documented in
METABOLIC_BOUNDARY_UNIT_AUDIT.md. The inspected scaling is dimensionally consistent;
no identified thousand-fold defect justifies changing production numerics.
Patient metabolic inputs are still not measured. No extra metabolic fitting
freedom introduced in this run.

## Completed result

31 ten-minute candidates plus three fresh thirty-minute confirmations: 34
dynamic runs, zero execution errors. All 31 candidates preserve terminal
mechanical screen; 14 meet O2/CO2/mechanical endpoint screen at ten minutes.
Selected winners preserve mechanical screen in all three thirty-minute runs;
one meets O2/CO2 limits. That case has substantially closer final pH/CO2 than
the earlier short-selected configuration, without changing metabolism or SID.
This supports long-horizon selection over short selection in this development
example, not a general comparative performance claim. No new pH pass rule.
Second-case CO2 remains high; third-case oxygen remains low. No full baseline
qualification, cardiovascular qualification or prediction accuracy established.

Contract verifies exact ensemble size/uniqueness, input hashes, selection from
mechanically acceptable candidates, unchanged selected controls/SID/gas fractions
and fresh thirty-minute replay agreement with each ten-minute candidate at
minute ten. Existing simulation/runner/source tests pass. No production files
changed. Patient records and numeric case endpoints remain outside GitHub.

## Next

Retain the improved long-horizon configuration and other alternatives. Now
perform long-horizon gas-fraction selection, not the earlier one-minute gas
selection, while retaining the fixed metabolic and acid-base priors. This is
a separate bounded experiment: do not retrospectively relabel this fixed-gas
comparison a full joint fit. Explicitly assess late changes and mechanics at
multiple checkpoints before qualifying unchanged-state behavior. Investigate
unresolved recruitment wiring and source-context eligibility separately.
