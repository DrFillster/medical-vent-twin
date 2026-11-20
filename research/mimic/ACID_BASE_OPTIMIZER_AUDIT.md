# Acid-base optimizer audit

## Scope

Development diagnostic on `research/baseline-stability-audit`, starting from
`b156429fd0857cdf5cbc5047111dae1054bc109f`. No live-site, UI, production engine,
locked cohort, acceptance threshold, or held-out outcome changes.

## Code finding

`fit_acid_base_joint_smoke.js` is a sequential, single-pass fit, not a joint
search. It selects CO2-elimination nuisance fraction at ventilated perfusion
0.85 using a CO2/pH objective. It then selects ventilated perfusion with an
oxygen-only objective and does not revisit CO2. Consequently the previous
negative smoke test does not exhaust the existing paired search space.

This is a search-method limitation. It does not establish that the physiology
is correct or that a different optimizer can rescue the phenotype.

## Diagnostic design

`fit_acid_base_paired_grid_control.js` first reruns the prior passing control
with the original nuisance parameters and explicit default SID. If that replay
fails, the diagnostic stops rather than attributing the failure to SID.

It then fits latent SID from pre-transition pH and searches all 48 existing
CO2-nuisance / ventilated-perfusion pairs at a 900-second search horizon. The
combined development objective includes baseline and final PaCO2, PaO2, and
pH residuals. It uses the existing gas normalizers and an explicit 0.10 pH
weight. That pH weight is an engineering search weight, not a clinical limit.

The best pair receives a fresh 3600-second confirmation. The historical gas
pass gate remains unchanged; pH residuals remain separately visible. A gas
pass alone is not proof of a fully valid acid-base phenotype.

This test changes both search coverage and objective relative to the prior
sequential script, so an improvement cannot isolate which change caused it.
It is one development control, not independent predictive validation.

## Data integrity

Only the conservative prefit file and the prior pre-transition refit artifact
are read. No post-transition outcomes are opened. Patient-level results remain
under the local MIMIC derived-data directory. The output is written exclusively
and will not silently replace an existing result. No patient rows are committed.

## Additional initialization finding

`patient_gas_initialization.js` retains source-prior venous bicarbonate and
venous oxygen content while applying the supplied SID to gas interpretation.
This is an explicit unmeasured-state assumption. Its contribution to drift has
not been isolated by this diagnostic; do not call it a proven cause or silently
replace it with invented venous measurements.

## Result

Pending completion of the bounded diagnostic and regression suite.

## Completed optimizer result

The default-SID control replay passed. All 48 paired-grid candidates executed
without errors. The selected combined-objective candidate failed the fresh
60-minute gas gate, with baseline CO2 error and CO2 drift outside the existing
limits. The live-session suite completed with 17 passes and zero failures;
the new synthetic scoring tests passed eight assertions.

Only the selected candidate received full 60-minute confirmation. This is not
proof that every pair fails that gate. Search coverage and objective changed
together, so the diagnostic does not isolate their separate contributions.
The outcome remains a development failure, not held-out validation.

The earlier pending-result sentence above is superseded by this section.
