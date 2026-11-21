# Final bounded development gas search - 2026-11-21

27 ten-minute gas-grid candidates at fixed long-selected mechanics and prior
SID/metabolism; three fresh thirty-minute confirmations. Existing dead-space
and ventilated-perfusion bounds and objective scales retained. Worst gas
objective across minutes five-ten ranks only mechanically acceptable
candidates. Mechanical measurements captured each minute; acceptance checks
minutes five onward plus terminal effort-count agreement. Not continuous
waveform agreement, not a new pH acceptance threshold.

All 30 simulations complete without execution errors. All three selected
confirmations preserve multi-check mechanical agreement; one meets terminal
O2/CO2 engineering limits. Other two remain gas-fit failures, including oxygen
mismatch in the newly selected second-case alternative. The search can trade
one gas error for another; report full gas vectors, not only optimized CO2.
No full baseline qualification, stationarity proof or prediction claim.
Development tuning of these examples stops here as agreed. Unsuccessful fits
remain in the record and in future coverage denominators.

Recruitment code-path disposition is NOT cleared: selected configurations
omit explicit kinetics, causing dynamic evaluation to use top-level defaults
instead of nested template values. New path-specific regression confirms this
and confirms the existing explicit-kinetics option exposes template thresholds.
The first test harness used an incorrect mechanics option key and failed;
correcting that key yielded a passing probe, with no simulator change.
Restricting intervention to FiO2 alone does not remove baseline recruitment
coupling. A research-path correction and regression is required before freeze.
See PREDICTION_PILOT_FREEZE_GATE.md for remaining explicit test gates.

Contract checks 27 unique candidates, complete per-minute mechanical records,
fixed winner parameters, fresh replay agreement at minute ten, finite outputs.
New runner hash recorded before execution. No post-change files read, no
production changes, no independent patient test outcomes inspected. Patient
records remain outside GitHub; research artifacts stay in existing derived
folders, with no redundant local exports.
