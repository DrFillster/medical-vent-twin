# Disease controls: current research-path audit

## Verified code facts

The current live reduced-core session accepts only one reference case:
berlin-moderate-moderate-aspiration. This is a runtime/template restriction,
NOT a source-verified diagnosis for the 19 MIMIC patients.
Source: clinical_twin_live_hummod_session.js, reference-case guard and signature.

The development adapter changes mechanics, drive, muscle transmission,
dead-space fraction, ventilated perfusion fraction and blood SID. Mechanics
are produced by scaling the common case's compartment stiffness/capacity and
central airway resistance (fit_controlled_mechanics.js:mechanicsParams).
These are configurable physiological controls, not independent disease labels.
Source wiring inspected; per-control perturbation tests remain pending.

Every case uses the same normal/recruitable/consolidated recruitment initializer
(1, 0.35, 0). These are compartment initialization states, not population or lung
fractions to sum to one. It also uses nominal awake_cooperative profile with
individual drive and muscle-transmission overrides. Nominal label does not
establish alertness, absence of sedation or normal strength in patient records.

## First evidence records completed

build_disease_evidence_records.py materializes all 19 cases (10 qualified,
9 failed), measured targets, baseline fit parameters, refinement decisions,
and fixed assumptions. Each has explicit empty unreviewed disease evidence,
unknown clinical phenotype, unverified measurement timestamps and required
reviews. Baseline and refinement parameters are kept separately to avoid
misrepresenting the original parameter set as the final recovered fit.
Patient-level records stay outside git in derived/dev-disease-evidence-v1.
No clinical diagnoses inferred, no patient outcomes read, no physics changes.

## Concrete gap

Current manifest retains transition timestamp but not individual source times.
vent_chart_events.parquet has charttime and storetime; those must be linked
back to the exact measurements used. A 'pre_' field name alone is insufficient
for availability-at-prediction verification. Existing phenotype packet includes
some derived values; no new derived clinical quantities are calculated here.
No diagnosis/radiology/note files found by the limited raw/derived filename
scan; this does not establish that source modules are absent or inaccessible.

## Next executable tasks

1. Reconstruct source charttime/storetime for supported measurements, without
   using post-transition entries; preserve unknown source rows, no guessing.
2. Inventory authorized source modules/locations before deciding clinical-note
   or diagnosis evidence availability. Do not download new restricted modules
   or infer absence from the filename scan.
3. Add synthetic evidence-contract tests rejecting post-cutoff inputs, defaults
   labeled as measured disease, and clinical diagnoses inferred from fit values.
4. Perturb each proposed control in isolated research sessions to verify actual
   effect. Review dependency on shared case and recruitment initialization.
5. Define bounded individual disease-state fitting only after this audit. Keep
   baseline experiments intact; no silent expansion of disease model claims.
