# Phenotype utility experiment plan - 2026-11-20

## Decision

No new phenotypes. One published assignment model only; Terry remains blocked
pending verified public deployment artifacts. No labels from descriptive medians.
Proceed independently with source-window extraction, common patient fitting
interface, paired experiment runner and independent cohort provenance.

## What information enables

Exact assignment: inputs, units, time windows, transformations, fitted scaling,
centers/coefficients, missing-data handling, label mapping, executable fixtures.
Label alone permits stratified coverage/error reporting. It does not supply
compliance, resistance, dead space, effort, shunt or effective perfusion values.
Parameter assistance additionally requires supported links or development-only
estimates, uncertainty and sufficient subjects per group. Preserve individual
measured values, shared physiological bounds and an unclassified state.

## Experiment stages

A: Existing individual fitting, no label, shared starting distributions.
B: Identical fitted twins/predictions; add labels only for stratified audit.
C: Same individual inputs, simulator, free parameters, hard bounds and compute
budget as A; change only group-informed starting distributions/soft priors.
Estimate C priors only from development subjects, checking parameter stability
and non-identifiability. Do not learn deterministic physiology from cluster
medians or from arbitrary fitted latent values. Retain shared fallback and
uncertainty. B answers consistency; C tests added information, not grouping.

No C fitting until classifier executable and prior definition frozen in dev.
No post-change values to initialize/classify. First-day label available only
after observation window. Use timestamp-verified clinical inputs; separate
assistance mode from effort. LLM may organize auditable source facts but cannot
invent missing values, assign unpublished classes or inspect held-out outcomes.

## Development tests

Use all 19 cases to exercise failures and coverage, not independent accuracy.
Report attempts, qualification, baseline agreement/drift, fit reproducibility,
parameter ambiguity and execution cost. No rescue via changing qualification
thresholds, compute budget or post hoc split. Initial two-hour checks follow
existing definition; freeze common qualification rules before A/C comparison.
Synthetic tests cover units, missingness, ordering, time boundaries, labels,
round-trip source provenance and immutable paired inputs.

## Patient-disjoint evaluation

Audit union of all prior development/evaluation subject sets. Exclude these
subjects from independent cohort, verify prior outcome access and source timing.
Freeze model source, classifier, priors, horizons, comparators and endpoint
rules before outcome access. Primary experimental intervention: observed FiO2
change in pressure support. Exact eligible transition criteria and concurrent
intervention rules prespecified. Primary prediction endpoint proposed: PaO2;
PaCO2/pH and HR/MAP separate secondary endpoints with availability and confounding
reported, no combined success claim. Match actual sample timestamps with fixed
windows and verify intervening settings. Stable/control replay validates code,
not the unobserved patient counterfactual or causal treatment benefit.

Compare persistence and development-trained fixed empirical baseline. Report
coverage in all eligible cases, accuracy in the common qualified set and
abstentions/failures in the full denominator. Report effects by phenotype with
subject-level uncertainty; small strata yield inconclusive findings. No fixed
sample-size claim before precision design using development variability.

## Retention and stopping rules

Ablation C retained only if prespecified qualification/accuracy benefit without
worse drift, implausible parameters or material subgroup harm. If labels only
explain failure, retain as audit layer; if no value, report negative result.
Do not create extra clusters to rescue performance. Alternative published model
requires complete public executable assignment verification and user-visible
change to method/aims, not silent replacement. No research result authorizes
bedside ventilator recommendations.

## Next deliverables

1. Source-linked pre-change patient packet and timing eligibility report.
2. One classifier readiness manifest listing verified versus missing artifacts.
3. A/B/C paired experiment interface, provenance and synthetic tests.
4. Frozen evaluation specification after development precision assessment.

Evidence: Gordon et al. AJRCCM 2024;210:155-166,
https://pmc.ncbi.nlm.nih.gov/articles/PMC11273306/ (prognostic vs predictive
utility); Terry et al. CHEST Crit Care 2025;3:100163,
https://pmc.ncbi.nlm.nih.gov/articles/PMC12646598/ (classification method).
This is a proposed experiment, not completed phenotype fitting or validation.
