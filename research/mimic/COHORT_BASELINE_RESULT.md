# Completed cohort baseline comparison and next batch

The locked composite development cohort contains 19 events. All 38 baseline
runs completed without operational errors. Original fixed-SID initialization
and candidate latent-SID/source-venous-PCO2-preserving initialization each pass
5/19. The same five cases pass both methods; zero paired improvements, zero
regressions, 14 failures under both. All original recorded pass classifications
reproduce. Original replay mismatch count is zero; the report template's
conditional warning does not imply a mismatch was found.

Candidate failure components overlap: baseline CO2 four cases; drift CO2
seven; baseline O2 six; drift O2 one. Do not sum them as independent failures.
This experiment holds the prior dead-space and perfusion fits fixed and does
not test the combined refined fitting method. It rejects a cohort-wide rescue
claim for the initialization/SID change alone. It does not establish that all
14 failures are intrinsic model limitations.

## Declared follow-up

Development-only perfusion refinement for every one of the 14 failures, retaining
the five baseline successes without rerunning them. For each failed event,
run all eight original perfusion grid points (plus the original point if not
already on that grid) for an hour, then at most four sign-bracket refinements.
Fixed candidate SID, dead-space nuisance, mechanics, effort and ventilation.
No post-transition outcomes. Preserve all failures and errors in denominator.
Maximum new candidates per failed case: 13 if the prior point is off-grid;
12 otherwise. No widening of parameter bounds. This is not a validation run.

`run_cohort_perfusion_refinement.js` checks parent input/source context, records
a new manifest and appends every simulated attempt. Resume uses exact-context
attempt cache; errors are not silently retried. Only one writer is supported.
Summaries checkpoint completed cases; the first case summary can be absent
until its grid/search is complete. A completed original pass is inherited,
not presented as a fresh simulation.

Artifacts under derived/dev-cohort-perfusion-v1. Results currently pending.
After completion report rescue count, unresolved cases, candidate errors,
selected final residuals and scope limitations. Do not change the locked gate.
Production source remains unchanged. GitHub publication remains pending.
