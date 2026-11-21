# Declared recruitment wiring correction - 2026-11-21

Research-only helper declared_recruitment_options.js reads declared template
kinetics and passes them through existing explicit adapter to both top-level
and nested compartment parameters. It does not alter production, calibrate
kinetics against a patient or change mechanics/drive/gas/SID fits. A correction
of intended-versus-effective wiring is not evidence that the authored template
kinetics are clinically correct for these patients.

Unit regression checks dynamic rates at six distending pressures, equality
between top-level and nested declared kinetics, no input mutation, no unrelated
option changes, and preserved feasible-volume floor. Existing legacy tests
remain intact and continue to identify legacy behavior, not a global fix.
The new helper is opt-in; previous runner artifacts remain historical legacy
outputs and are not silently reclassified or overwritten.

Paired replay design: three saved development configurations x legacy/declared
kinetic paths x unchanged/synthetic FiO2 step. Each runs 1800 seconds baseline
plus 300 seconds observation. Synthetic FiO2 increase is 0.10 capped at 1,
requested at 1800 seconds, applied at next completed-breath boundary. It is an
engineering perturbation, not recorded patient treatment or advice. All fitted
patient parameters remain fixed. No outcomes read or optimization performed.
Before dynamic execution, runner/helper/relevant adapter and core src hashes
and exact patient-input hashes are recorded. This captures the inspected
source set, not a complete environment/package reproducibility lock.

Contract checks complete unique arm/scenario grid; unchanged fit parameters;
matching pre-perturbation trajectories within each kinetic arm; legacy baseline
reproduction; finite outputs and applied synthetic FiO2 with no pending change.
This cannot validate patient outcomes, PEEP response, pressure-support response,
or full baseline qualification. Existing source-context, pH/drift acceptance,
comparator, prior-use and cohort-separation gates still apply.

## Completed results

All 12 replays completed without errors. Contract passes all source/input hash,
fixed-parameter, pre-step identity and historical replay checks. Synthetic
FiO2 setting applied in all requested arms. All recorded per-minute gas and
mechanics/ventilator checkpoints are identical between legacy and declared
paths in these three cases, both unchanged and with the synthetic FiO2 step.
Mechanical baseline screen remains satisfied in all three; previous gas-fit
failures remain. No improvement or worsening attributed to wiring in these
conditions. This does not show that the legacy defect is harmless generally:
rate-level probes do differ when distending pressure activates those regimes.
PEEP/pressure-support perturbations and full recruitment trajectory comparison
are not tested by this batch. Corrected helper is available for explicit pilot
integration; no existing runner silently switches semantics.

Next: register the corrected helper as the candidate protocol's required path,
complete source-block/acceptance/comparator rules and patient prior-use ledger,
then freeze predictions before outcome access. No more tuning these examples.
