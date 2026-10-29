# Adult respiratory digital twin: first deliverable

Date: 2026-10-29
Branch: `research/adult-respiratory-twin-pilot`
Status: planned; no patient-level data analyzed or physiological validation claimed.

## Objective

Produce an **adult-only data-availability and identifiability pilot**: a manually reviewed cohort of ventilator transitions, a traceable minimal respiratory model, and blinded predictions compared with simple baselines. Determine which patient properties the available measurements can constrain and which additional measurements are needed.

This plan supersedes the root recovery plan on this research branch. The previous plan is preserved verbatim in [docs/history/physiology-recovery-plan-through-2026-10-27.md](docs/history/physiology-recovery-plan-through-2026-10-27.md). Historical entries do not establish completion of this pilot.

## Baseline and ownership

- Branch point: `d9afe54507033eb03a504710b952f8a0ee047476`, from `integration/v16-ui-v24-physiology`.
- Accepted HumMod runtime: `1a8f83ad212194750d79dd42128e1ee713756870`; see [ACCEPTED_BASELINE.md](ACCEPTED_BASELINE.md).
- Research code belongs under `research/adult-twin-pilot/`, isolated from the accepted UI and deployed engine. No changes to either published website are part of this pilot. Vent remains frozen except for its existing authorized HumMod link.
- ChatGPT/Work owns repository changes. The local Mac LLM remains validation-only: no authored changes, commits, pushes, branches, PRs, or deployments.
- Existing software acceptance does not establish physiological validity. Retain and disclose known baseline failures.

## First clinical question

For adults receiving passive, invasive volume-controlled ventilation, can a model conditioned only on information available before a ventilator change predict the subsequent measured respiratory response, with calibrated uncertainty?

Evaluate treatments clinicians actually delivered. This pilot cannot establish optimal settings, treatment benefit, or outcomes under unobserved alternatives.

### Population and transitions

- Age at least 18 years at the index admission; invasive volume-controlled ventilation with adequately documented settings and timing.
- ARDS-focused cohort, with clinician adjudication of diagnostic criteria, timing, and uncertainty. An ICD code alone is insufficient.
- Require evidence supporting passive ventilation. Sedation alone does not prove passivity; classify unknown effort separately and exclude it from the primary analysis.
- Exclude ECMO, major air leak, unsupported modes, and uninterpretable timing from the primary cohort. Record reasons and counts.
- Select one primary transition class after the availability audit: isolated PEEP, tidal-volume, respiratory-rate, or FiO2 change. Prefer adequate paired measurements and minimal concurrent intervention. Document the choice before fitting models.
- Lock the index-time rule, minimum change magnitude, stable pre-change period, persistence requirement, and exclusion windows before opening held-out outcomes.
- Flag concurrent proning, recruitment maneuvers, multiple setting changes, and material fluid/vasopressor or other treatment changes. Exclude them or analyze them in prespecified separate strata.

### Outcomes and timing

Candidate outcomes are plateau/driving pressure, PaCO2, arterial pH, and PaO2. Select primary outcomes according to actual paired-measurement availability; report an explicit denominator for each.

Proposed windows are 5–30 minutes for mechanics and 30–120 minutes for the first subsequent ABG. Confirm feasibility using development data and record changes before test-set lock. These are analysis windows, not claims that physiological equilibrium has been reached.

Require valid measurement conditions for plateau/driving pressure. Do not substitute peak pressure for plateau pressure or SpO2 for PaO2. Prespecify handling of multiple observations, missing outcomes, and uncertain timing.

## Work package 1 — Access, availability, and adjudication

### Tasks

1. Confirm authorized MIMIC-IV v3.1 access and a credentialed analysis environment. Public documentation is not evidence of actual patient-data access.
2. Pin dataset release, extraction code revision, item identifiers, units, and timing conventions.
3. Inventory mode, PEEP, set/observed tidal volume and rate, FiO2, peak/plateau pressure, ABGs, SpO2, height/sex variables needed for predicted body weight, sedation, neuromuscular blockade, positioning, and relevant circulatory treatments.
4. Distinguish measured, documented, derived, and unavailable values. Never replace missing measurements with reference-simulator defaults.
5. Preserve measurement time and result/documentation availability time when available. Predictions may use results only after they would have been available clinically.
6. Audit unit conversions, duplicates, implausible values, irregular sampling, inconsistent settings, and event alignment. Record every correction/exclusion rule.
7. Report candidate transitions, usable patients, paired outcomes, and missingness. Verify actual overlap before proposing linked waveform or imaging analyses.
8. Manually adjudicate an initial 30 candidate transitions as an engineering feasibility sample, not a powered validation cohort. Determine expansion from observed yield and a documented precision calculation for the selected primary outcome.

### Outputs

Under `research/adult-twin-pilot/`:

- `protocol.md`: clinical definitions, windows, estimands, exclusions, and versioned amendments.
- `data_dictionary.csv`: source fields, units, timing, derivations, and quality rules.
- Versioned extraction and quality-check code.
- Aggregate screening flow, availability matrix, missingness report, and adjudication rubric. Patient-level adjudications stay in the credentialed environment.

### Gate A

Proceed only if paired measurements support at least one prespecified prediction question. If yield is insufficient, deliver the audit and an additional-data specification. Do not fabricate trajectories, assume passivity, or relax inclusion rules after seeing test performance.

## Work package 2 — Minimal model, provenance, and identifiability

### Tasks

1. Choose the smallest model supported by Gate A. Begin with a single-compartment mechanics comparator; assess whether a small heterogeneous model adds estimable information.
2. Define measured boundary conditions separately from estimated parameters. Couple mechanics and gas exchange through explicit, dimensionally consistent relationships.
3. Create an equation/parameter ledger: primary source and version/page/equation, population/species, units, implementation location, adaptations, valid domain, and validation evidence. Leave unresolved constants explicit rather than inventing them.
4. Record inherited assumptions, including the arterial-versus-alveolar oxygen input in the pulmonary vascular pathway. Any correction must be isolated and verified in the research model; this plan does not authorize modifying accepted deployed physiology.
5. Assess structural identifiability where feasible and practical identifiability using sensitivity analysis, parameter profiles, and/or posterior distributions.
6. Test recovery on synthetic records with realistic noise, missingness, and sampling. Synthetic recovery under a known model is not human validation.
7. Reduce or fix unsupported parameters using explicit sourced assumptions. Do not present fitted regional recruitment or shunt as measured truth.
8. Retain multiple plausible parameter sets and propagate parameter/measurement uncertainty into predictions. Specify how model discrepancy is assessed and represented.

### Outputs

- `model_spec.md` and `parameter_ledger.csv` under the research directory.
- Research-model code with unit/conservation, limiting-behavior, numerical-stability, and synthetic recovery checks.
- Identifiability report listing supported parameters, unresolved trade-offs, prediction uncertainty, and the measurements needed to resolve ambiguity.

### Gate B

Advance only the identifiable model/parameter subset. If equally plausible states make materially different predictions, retain the ambiguity and define an abstention condition. A good fit alone is insufficient.

## Work package 3 — Locked retrospective prediction experiment

### Tasks

1. Split by patient; all episodes from one patient stay in one partition. Lock development, tuning, and held-out test membership before fitting. Assess temporal transportability using valid dataset timing metadata.
2. Use development patients for model selection and population priors; use tuning patients for interval calibration and abstention thresholds. Never calibrate on held-out outcomes.
3. At each index time, use available pre-change information and newly prescribed settings. Freeze predictions, prediction intervals, model revision, and abstention status before the evaluation process accesses subsequent outcomes.
4. Separate prediction generation from outcome scoring with an auditable prediction freeze. This is retrospective computational blinding, not a prospective study.
5. Compare against persistence of the last valid measurement, an applicable simple mechanics/gas-exchange baseline, and a prespecified statistical baseline trained on development patients. Use matching eligible episodes and available inputs; disclose baseline-specific coverage.
6. Report bias, MAE/RMSE, agreement limits, clinically important misses, interval coverage/width, abstention rate, and patient/episode counts. Use patient-clustered confidence intervals.
7. Before test-set lock, obtain physician-owner specification of primary outcome, clinical error tolerances, minimum useful improvement, desired precision, and secondary-outcome handling. Record these in `protocol.md`; no retrospective threshold selection.
8. Examine failures by severity, transition type, missingness, and clinical context. Small subgroup results remain descriptive.

### Outputs

- Frozen configurations, split manifests, prediction records, and scoring outputs in the credentialed environment.
- Evaluation code and non-sensitive aggregate tables/figures in the research directory.
- Exact source SHA, dataset release, dependency/environment versions, random seeds, and protocol/model versions for each run.

### Gate C

Feasibility requires evaluable records, an identifiable model subset, and auditable held-out predictions. A claim of predictive benefit additionally requires meeting the prespecified improvement and uncertainty criteria. Failure to outperform a baseline is a valid result; do not tune against the test set.

## Final deliverable and completion criteria

Write `research/adult-twin-pilot/pilot_report.md` containing:

1. Screened and retained patients/episodes, exclusions, missingness, and selection limitations.
2. Locked clinical question/protocol and all deviations.
3. Model provenance and departures from published sources.
4. Identifiable patient properties, unresolved alternatives, and uncertainty behavior.
5. Blinded held-out comparisons, negative findings, abstentions, and failure examples.
6. Reproduction instructions and exact data/code versions without exposing patient-level information.
7. A decision: proceed to external evaluation, simplify/revise the model, or acquire additional measurements.
8. A prioritized acquisition specification: synchronized airway pressure/flow/volume and settings, ABGs and interventions; esophageal pressure, EIT, or CT only where the clinical question requires them.

Completion requires a documented disposition for Gates A–C and a clear statement of what can and cannot be inferred. A blocked data-access prerequisite or failed feasibility gate is reported explicitly; it is not successful completion of predictive validation.

## Boundaries

- Adults only; no pediatric cohort, scaling, or validity claims.
- No optimal-PEEP, treatment-benefit, mortality, arrest-timing, autonomous-control, or reinforcement-learning claims in this deliverable.
- Additional compartments must earn their place through data support and predictive value.
- External multicenter evaluation and prospective shadow validation are subsequent deliverables.
- No patient records, fitted patient twins, sensitive manifests, or restricted derived artifacts in public GitHub, public CI logs, or either website. Apply source agreements to derived models as required. Public tests use synthetic fixtures.
- This planning commit implements no clinical-data analysis, runtime change, or production deployment.

## Reference starting points

- [MIMIC-IV v3.1 and derived-data/model guidance](https://physionet.org/content/mimiciv/3.1/).
- [Official ventilator-setting extraction concept](https://github.com/MIT-LCP/mimic-code/blob/main/mimic-iv/concepts/measurement/ventilator_setting.sql); pin a revision before use.
- [MIMIC-IV Waveform v0.1.0](https://physionet.org/content/mimic4wdb/0.1.0/): bedside-monitor signals do not establish ventilator waveform availability.
- [Practical respiratory-model identifiability, 2025](https://doi.org/10.1007/s11538-025-01497-z).
- [Prospective global/regional lung-model evaluation, 2026](https://doi.org/10.1186/s12931-026-03949-z).
- [CCVW-ICU waveform dataset description, 2025](https://doi.org/10.1038/s41597-025-06364-z): small pressure-support cohort; methods adjunct, not linked MIMIC or broad ARDS validation data.

## Execution checklist

- [x] Adult-only scope agreed with physician owner.
- [x] Research branch created from accepted HumMod integration; prior plan archived.
- [x] First-deliverable plan written; runtime and UI untouched.
- [ ] Authorized access and analysis environment confirmed.
- [ ] Gate A: availability audit and clinical protocol locked.
- [ ] Gate B: model provenance, verification, and identifiability completed.
- [ ] Gate C: frozen held-out evaluation completed.
- [ ] Pilot report reviewed and next-stage decision recorded.
