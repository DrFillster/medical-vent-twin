# First similar-settings development experiment

Selection fixed before new outcome access: all groups with >=2 cases sharing
exact mode, PEEP, pressure support and starting FiO2 among the existing 19.
This is ventilator-setting similarity only, NOT matched physiological severity,
disease, effort or published phenotype. No new clusters inferred. Existing
input-time limitations remain; development cases only, not new validation.

Four groups, nine cases. Eighteen fresh 60-second coupled simulations (recorded
FiO2 and unchanged settings), zero execution errors. Three cases had previously
qualified baseline fits; six had previously failed and remain visible. Failed
cases use saved baseline parameters, not falsely claimed recovered fits.
No parameter retuning. Fresh runs test execution, not one-hour prediction.

Exploratory outcome window fixed in separate manifest before reading outcomes:
45-75 minutes, closest to one hour, nearest saved five-minute prediction grid.
Three selected cases had a complete arterial gas in that window. Only one had
a qualified saved one-hour prediction plus an observed gas. Raw comparison
retained outside git; no patient-level values or identifiers published here.
One raw comparison cannot establish accuracy or superiority. Intervening
ventilator/medication changes are not yet audited. Raw prediction time differs
from observation time; document difference rather than interpolate physiology.

This pass explicitly unblinded subsequent blood gases in selected development
patients. Earlier outcomesRead=false statements remain historical, not current.
No independent test set touched. No production changes or disease assignments.

## Interpretation

The immediate limitation is representation/coverage, not execution. Equal
ventilator settings do not imply equal patient physiology; this experiment
must not be described as matched disease-state validation. Next select truly
physiologically comparable cases with timestamp-verified inputs, complete
outcomes and intervention history, preserving failures. Retain this first
comparison as development evidence and do not tune on it then claim validation.
