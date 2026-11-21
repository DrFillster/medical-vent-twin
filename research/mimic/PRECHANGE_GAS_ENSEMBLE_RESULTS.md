# Pre-change gas ensemble engineering screen - 2026-11-21

## Design and eligibility

Three source-context-matching cases enter a provisional engineering experiment.
One case with missing PS-at-MV context is excluded. Matching recorded context
is NOT clinical adjudication; same-time order and steady exposure remain
unresolved. This is deliberately a provisional screen, not authorization for
clinical baseline qualification, prospective prediction or disease assignment.
31 retained mechanical alternatives span those three cases; no candidate is
selected using post-change outcomes. Original source and parameter ledgers
remain untouched. No previous fitted gas parameters read.

Each alternative tested at three dead-space fractions and three ventilated-
perfusion fractions: 279 fresh 60-second coupled runs. Grids are exploratory
engineering settings, not measured patient fractions or recommended ranges.
The reference SID, circulation and recruitment state remain unchanged. pH is
recorded but not fitted or qualified. Dead-space/perfusion values are effective
model inputs, not proven anatomical or disease measurements.

Gas initialization uses measured pre-change pH/PaO2/PaCO2, but endpoint screens
follow free evolution. Initial agreement is therefore constructed, not evidence
of fit. Existing development engineering residual limits (8 mmHg CO2 and
20 mmHg O2) reused, not clinical guideline thresholds. Mechanical targets still
must pass the existing 20-percent screen and effort-count rule after gas fitting.

One best short-run mechanical-consistent configuration per case receives a
fresh 600-second run with fixed parameters. This checks temporal persistence
of the selected fit; all short candidates remain in the ledger. Only selected
winners receive longer confirmation, not the whole gas ensemble. Endpoints
alone do not establish stationarity. No post-change measurements read here.

## Limits and next work

This bounded first pass cannot qualify all aims: pH/SID, longer unchanged-state
behavior, cardiovascular targets, source/block clinical validity, and model
identifiability remain unresolved. No threshold expansion to rescue failure.
Do not present short fit as predictive performance or add these to old 10/19.

Next inspect failures by mechanism: poor gas representation, loss of mechanical
fit after coupling, or time drift. Refine only against pre-change data, retain
failed cases, check every endpoint and propagate retained alternatives into
later prediction work. Production and independent cohort unchanged.

## Completed results

279 short simulations plus three fresh ten-minute confirmations complete,
zero execution errors. 27 short configurations meet the joint O2/CO2 and
mechanical endpoint screens, all in one case. Only that case also meets joint
O2/CO2/mechanics limits at ten minutes. Mechanics remain acceptable in all
three confirmation runs. This is NOT a recovered full baseline case.

Importantly, the O2/CO2-passing case has substantial pH mismatch under unchanged
reference acid-base settings. Its gas-screen pass cannot stand in for pH
qualification or a clinically coherent initial state. Another case retains
high simulated CO2; the third retains low simulated oxygen. The coarse gas
parameter grid is not a proof of infeasibility. Some selected values reach
grid boundaries; do not simply broaden to extreme values to force agreement.

Next priority is explicit acid-base initialization/parameter review plus
bounded pre-change gas refinement and fresh mechanics checks. Retain all
failures. No case is labeled fullBaselineQualified. No additional patient-level
numerical results or identifiers published to GitHub. Source/input hashes
recorded after launch for reproducibility, not a prospective source freeze.
