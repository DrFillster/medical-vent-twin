# Prediction pilot freeze gate - candidate, NOT locked - 2026-11-21

## Stop further patient-specific development tuning

Final bounded gas-grid experiment ends repeated adjustment of these development
examples. Preserve failures, retain complete fitting provenance and report all
eligibility/fit failures. Finishing that search does not authorize independent
outcome scoring while the gates below remain unresolved.

## Recruitment disposition: selected path affected

The selected time_verified_ps_runner supplies no recruitmentKinetics. The
explicit adapter therefore leaves nested template thresholds. The dynamic
recruitment path reads compartment top-level keys and uses its defaults:
P_open=25, P_close=10, k_open=.02, k_close=.05. Template nested values differ.
Regression reproduces actual behavior across pressure probes and confirms
that the existing explicit-kinetics option changes the mismatched behavior.

Consequently the selected path IS affected; restricting changes to FiO2 does
not by itself remove pressure/recruitment coupling during baseline fitting.
Do not declare pilot-ready or silently call the legacy dynamics fixed.
Next engineering step: choose declared explicit kinetics from the existing
model template, connect them through the existing research option, and run
paired baseline/intervention regression before a final lock. This is a code-
path correction, not another clinical parameter search. No production edit
or test-patient outcome inspection is authorized by this document.

## Required gates before independent test outcomes

- Canonical input mapping, same-setting source blocks and availability rules;
  retained exclusions and complete prior-use ledger by patient.
- Explicitly versioned, tested recruitment/initialization path and entire
  dependency source hashes. Earlier development fits do not automatically
  transfer after correcting kinetics.
- Fixed fitting sequence, bounds, objective, time horizon, initialization and
  failure rules. Baseline pH acceptance and late-drift criteria still need a
  supported, explicit specification; .05 objective scale is NOT acceptance.
- Deterministic persistence plus training-only data comparator implementation,
  fixed features, training split and endpoint time selection. No training from
  test patients or pre-freeze post-change outcome selection.
- Patient-disjoint candidate cohort verified against ALL prior-use ledgers,
  with outcomes withheld until locked predictions are generated.
- Endpoint-specific scoring plan, uncertainty reporting and patient-level
  aggregation; qualification coverage and failures reported separately.
  No HR/BP validation claim from gas tests. Phenotype benefit still untested.

## Current status

Development search can close; independent prediction lock remains pending.
Do not invent a sample size, model comparator or completed cohort check to
fill this document. Implementation and evidence decisions must be recorded
before test labels are exposed. This file is a gate checklist, not a completed
protocol, registration or clearance. No request for user action yet: the next
blocking task is technical recruitment-path regression, not more tuning.
