# Mechanical ensemble, joint drive search and source alignment - 2026-11-21

## Long replay of alternatives

Deduplicated the earlier passing mechanical candidates by case and all five
control values. Earlier counts (14, six, 17) were passing evaluations, not
necessarily unique configurations: timing and mechanics stages can repeat a
configuration. There are 36 unique alternatives. All 36 pass the unchanged
engineering screen after a fresh 600-second replay, with no execution errors.
This confirms sustained endpoint agreement under the current reference gas/
recruitment conditions, NOT clinical stability, blood-gas accuracy, waveform
agreement or one true disease model. Still uses last completed breath and
correlated VT/MV/RR targets. Candidate multiplicity is preserved outside git.

## Joint search

The previously failed fourth case now has all seven original drive values
crossed with the 81 independent-control combinations, instead of fixing drive
before changing mechanics: 567 short candidates. Original screen and bounds
unchanged. Best effort-consistent candidate receives a fresh 600-second run.
All 567 completed without errors; 28 pass the short engineering screen. The
best candidate also passes a fresh ten-minute replay. Fourth-case failure was
therefore a limitation of staged drive selection, not demonstrated inability
of the tested model to represent these mechanical targets. Only the best of
these 28 has ten-minute confirmation; all 28 remain in the short-run ledger.
This is development expansion of the search design, not an independent test.
No post-change measurement or previously fitted gas parameters read.

## Context alignment before gas fitting

All four time-eligible cases were checked for recorded settings at each source
measurement time (VT, MV, total RR when present, and the arterial specimen).
Three have matching settings documented at or before all these sample times.
One lacks a prior/same-time PS setting at the MV sample; its VT and MV were
charted at different times. That target combination is not authorized for
joint mechanical/gas qualification without reconstruction of a compatible
measurement block. No conflicting later records found, not proof of stability.

Many entries share a chart time with settings. These may be routine observation
blocks, but they do not prove ordering, a steady exposure, or measurement
reliability. All four retain alignment-confirmed=false; recorded match is
not clinical adjudication. Older six-hour history is used only to inspect
context, NOT to silently change the original two-hour eligibility rule.

## Continuation

Preserve all long-replay passing configurations. Reconstruct same-setting
observation blocks and validate units/type before fitting blood gases; do not
combine gas targets taken under unknown support with latest settings. For
supported blocks, fit gas-exchange parameters using pre-change observations
only, then recheck mechanics because the coupled respiratory controller can
change breathing. Retain unsuccessful configurations and quantify prediction
spread. No production or independent test-cohort changes.

## Verified batch totals

567 joint short candidates, 36 ensemble confirmations and one best joint
confirmation: 604 fresh simulations, no execution errors. Now all four
time-eligible cases have at least one selected mechanically acceptable
configuration at ten minutes. This is NOT four gas-qualified patients.
37 long-replay configurations retained for future work; one case still has
measurement-context mismatch as above. Run contract checks unique attempts,
finite outputs, screening counts and explicit absence of gas qualification.
Source inventory recorded after launch, not claimed prospectively frozen.
Pure runner unit test checks independent stiffness/capacity, deterministic
fresh replay and invalid input rejection. Six existing simulation programs
and strict-source synthetic test also pass.
