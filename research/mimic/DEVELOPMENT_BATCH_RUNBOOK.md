# Cohort baseline qualification batch v1

## Purpose and scope

Consolidate baseline qualification into one configurable, checkpointed runner.
Use the 19 locked PS composite-oxygenation events only. The 24-row prefit lock
also contains five history-decomposable events, which are separate. The prior
22-row fit artifact contains the 19 composite events plus three history cases;
it is NOT a 22-case composite cohort. Preserve this denominator distinction.

This is development qualification, not intervention prediction or validation.
The batch uses only existing pre-transition inputs. No truth file is opened.

## Conditions

For each of the 19 events run the original fixed SID/default venous state,
then fitted latent SID with source-venous-PCO2-preserving initialization.
Both use exactly the prior fitted dead-space nuisance and perfusion values.
No perfusion refinement or new dead-space fit occurs in this comparison.
This isolates the combined SID/initialization pathway cohort-wide; it does
not separate those two effects. Both successes and regressions must be shown.

## Execution

`node research/mimic/run_development_batch.js --data-dir PATH --out-dir PATH`

The runner records input SHA-256 values, all runtime-JS source hashes, adapter,
mechanics and refiner hashes, cohort membership, horizons and condition rules.
Restart only against an identical manifest. Each completed case-condition is
appended once to the ledger; a partial malformed line causes a hard stop,
not silent truncation. Operational errors are recorded and remain in the
denominator. Summary updates use atomic rename. One writer per output folder;
concurrent writers are not supported. No automatic retry of recorded errors.

Artifacts: manifest.json, results.jsonl, summary.json. They contain sensitive
research data and remain outside GitHub. Reuse the output folder for resume,
not unbounded new run logs. Changed code/inputs require a new declared context.

## Checks

`node research/mimic/test_development_batch.js DATA_DIR OUTPUT_DIR`

Checks manifest and input fingerprints, cohort separation, finite checkpoint
ledger, duplicate prevention, independently recomputed gas gates and rejection
of foreign-context resume before any simulation. A partial check is not a
complete cohort result. Model source is unchanged by this adapter extraction.

## Current state

First full 38-run batch launched in `dev-batch-baseline-v1` under derived data.
Results pending completion. After completion audit original pass replay, then
report paired improvements/regressions and failure components. Only then
choose the next batch fitting step. No case-specific patching or validation
unblinding. Production and locked protocol unchanged. GitHub update pending.
