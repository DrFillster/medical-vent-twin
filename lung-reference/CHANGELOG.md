# 0.2.0-rc1 - separate rewrite of the supplied review package

## Fixed

- Presets now load directly from the canonical model; Injury C no longer quietly
  substitutes Hb 9.5, VCO2 0.250, and a conditioned snapshot for the benchmark case.
- Snapshot history reset uses the current PEEP. Modified inputs invalidate output
  and exports. Specific validation errors are preserved.
- Trial headers now match values and units. Undefined rows retain their reason.
  The result is labeled a decremental PEEP-compliance sweep, not a P/V loop.
- The JS configuration is actually frozen, including copied fraction arrays;
  unknown configuration keys are rejected. Python fraction inputs are frozen too.
- Numeric booleans are rejected; relay count has an explicit 8-4096 resource guard.
- Empty-valid-domain trials have a stable label in both implementations.
- The JS analytical power test now uses an independent closed-form primitive,
  not a second copy of the same bisection/trapezoidal integration.
- Cross-language verification compares complete schemas, complete trial rows,
  explicit failure states and full relay vectors without rounding. NaN-to-NaN,
  missing keys, and boolean-to-number comparisons cannot silently pass.
- Python/JS audits now share a complete schema, including FiO2 labels.
- CLI case names containing spaces are quoted. Logs, results and hashes are
  regenerated as a coherent release rather than copied with stale hashes.

## Rewritten

- Browser UI with canonical case selection, every model parameter, explicit
  independent histories, meaningful errors, and configuration-bearing JSON exports.
- CLI harness, comparison program, verification runner and documentation.
- Manuscript with internally generated numerical tables, explicit assumptions,
  corrected mathematical notation and citations, and no unsupported novelty,
  cohort-reproduction, clinical-validity or teaching-efficacy claim.
- Release checklist, author metadata, licensing-status notice and remaining critique.

## Intentionally retained

The supplied v0.1.0 reference model's volume law, oxygen-content mixing,
recruitment relay law, signed endpoint index, illustrative numerical parameters,
and API candidate grid remain conceptually unchanged. This is an engineering and
reporting revision, not a new calibrated physiology model. No patient data were
used. We did not force values into published cohort ranges or hide awkward outputs.

## Baseline review evidence

Before rewriting, the supplied Python 24-test suite, JS 24-test suite and limited
cross-check passed; `npm run benchmark` failed. A DOM probe reproduced the reset,
stale-output and trial-column defects. Four inner-manifest entries were stale,
and the packaged Python test log was empty. These observations motivated this
revision; they are not claims of a failed clinical validation study.
