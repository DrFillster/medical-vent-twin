# Static cohort validity review - 2026-11-22

## Scope and execution boundary

Read-only source inspection through GitHub after the remote Mac command runner rejected the combined source-QC write/run command. This note is independent documentation, not a retry of that operation. No patient records accessed, no source-QC run, no new tests executed, no fitting or outcomes inspected. No production or evaluation-path changes. The blocked source-QC script is NOT represented as executed.

Reviewed branch files:
- build_documented_airway_cohort.py (blob 285e998ed9bc6dc4a947db0477c04d81a545f5e0)
- screen_candidate_exposure_alignment.py (blob b4aa79dc039e671680b2a51b611bf6fffaad28ed)
- screen_prechange_candidate_inputs.py (blob 94d7a845023b46f004de9fc620ffbf9b96fb6ced)
- candidate_pilot_session.js (blob 1fdd72c17cdd15d1d14eda1d80a6547edff14732)

## Confirmed source-level findings; patient impact unknown

### 1. Conflicting positive airway values collapse to the same class

assess() creates a set of classify(item,value) outputs at the latest pre-baseline timestamp. Different raw values that both classify positive produce {'positive'} and therefore support inclusion. Example: same-time ETT sizes 7.0mm and 8.0mm are not detected as a conflict by that predicate. Earlier documentation that all same-time conflicting latest values fail is too broad. Synthetic tests currently shown do not establish this positive-versus-positive case.

Required correction: normalize field values with explicit identity, reject differing same-time normalized values before applying presence class. Preserve exact duplicates. Regression cases: positive/positive mismatch, positive/negative mismatch, identical duplicates, null and unknown values. Do not infer an affected patient count without rerunning authorized source QC.

### 2. A negative on a different field before baseline need not block a family

Current same-family global negatives are searched only from baseline start onward. Before baseline, a field whose latest value is negative or unknown simply does not add support; two other positive fields can still accept that family. This is the pre-baseline cross-field review gap already listed in the cohort package, now confirmed directly in the predicate.

Required disposition: flag these cross-field states for an explicit reviewed decision; do not treat Not applicable on one field as automatic global extubation. Keep review/unknown separate from final clinical non-eligibility. Include temporal precedence and same-time ambiguity in tests.

### 3. Duplicate chart blocks can contain an unchecked missing unit

The latest-chart block query uses count(distinct valueuom), min(valueuom), and nunits=1 on mechanics/pressure gates. SQL aggregate distinct/min ignore NULL. A duplicate block containing the accepted unit on one row and NULL on another can therefore satisfy the unit predicate; unlike numeric completeness, unit completeness is not checked row-for-row.

Required decision and correction: declare whether every contributing row must have a valid unit. Under the stated strict completeness policy, require count(valueuom)=count(*) and consistent normalized units. Add tests for valid+NULL, valid+wrong, all NULL, and exact valid duplicates. Do not retroactively claim those rows were excluded by current code.

### 4. Secondary ventilator mode is not in the baseline exposure grid

Initial mode availability checks inspect item 229314 as well as 223849 within the latest two-hour window. The later exposure grid includes only primary mode item 223849, plus FiO2, PEEP and pressure support. It therefore does not establish absence of earlier conflicting secondary-mode entries across the entire baseline exposure period. The sixteen checks establish exactly those four settings, not every documented ventilator mode stream.

Required disposition: add an explicit reviewed secondary-mode chronology check or document and justify narrower source precedence. Missing secondary records are unknown/absent evidence, not automatically a conflicting mode. Tests must cover an earlier conflict that later resolves and simultaneous discordance.

### 5. Evaluation lock is a declaration contract, not artifact verification

requireEvaluationLock() verifies boolean fields and schema; its own comment correctly says callers must verify actual hashes, identity ledger and committed predictions. No artifact verification is performed by the function itself. This is a known design limitation, not proof evaluation has occurred improperly.

Required before scoring: bind reviewed lock fields to actual source, input, partition, fit/protocol, comparator, scoring and prediction artifacts. Verify content hashes and ordering evidence before opening reserved outcomes; test mismatched and absent artifacts. Do not set every boolean true merely to proceed.

## Consequence

241 patients, 199 provisional comparator-training and 42 provisional reserved-test, remain the last reported candidate allocation, not a newly certified count. Source-level gaps mean count changes are possible after correction. Do not reshuffle partitions, optimize acceptance on reserved outcomes, or restart old patient tuning to compensate. Retain old ledgers and all source-QC flags with versioned replacements.

## Next complete milestone

After execution access is authorized, address these source-QC findings with exact regression cases and rerun baseline-only cohort checks. Preserve deterministic patient allocations and document each count change. Finish fixed fitting, acceptance, drift, comparator and scoring specifications before any independent outcome evaluation. Published-phenotype benefit and predictive accuracy remain untested by this review.
