# Candidate pilot integration and identity audit - 2026-11-21

## Candidate session integration

candidate_pilot_session.js combines corrected declared recruitment wiring with
the existing research venous-PCO2-preserving initializer. Explicit bounds and
required-gas checks reject invalid inputs. Import before live session in a
fresh worker: previously loaded sessions are rejected to avoid silently using
the wrong cached initializer. Candidate session smoke and invalid-input/order
tests pass. This is not a fitting workflow, outcome runner or locked protocol.
The session factory remains available for engineering runs, without claiming
that those runs are independent evaluation.

requireEvaluationLock checks that review fields are complete before scoring.
It is a fail-closed shape contract, NOT an access-control or evidence verifier:
caller must verify actual hashes, identity records, signed-off rules and
prediction artifacts. No actual reviewed lock exists, and no outcome scoring
runner is authorized or integrated here. Tests reject absent/partial review.

## Conservative historical identity inventory

SQL reads identity columns only, not post-change values or endpoint timing.
Two canonical fitting inventories contain 502 unique mapped events across
286 subjects. Seven root-level JSONL index artifacts inventoried, including
one empty preflight. All nonempty indexed event IDs resolve to canonical
identities. Exclude every mapped subject conservatively, not just events known
to have scored outcomes. The audit does not assert outcome exposure for every
inventoried subject, and root indexes alone are not a complete historical-use
ledger (nested artifacts, repositories and prior branches remain to check).

The existing supported-mode pool has 411 distinct events in 292 subjects.
Only SIX events in SIX subjects lie outside these mapped historical subjects.
This is not six qualified patients and not an independently certified test set.
Eligibility, source-context availability and complete prior-use remain untested.
Furthermore the existing pool-builder used downstream outcome/context criteria;
identities outside fitting history do not erase that selection dependency.
The identity audit deliberately does not read those outcome columns.

## Consequence and next work

Do not reuse an old 'blinded' label or relabel repeatedly used patients as new.
The existing pool is nearly exhausted under conservative subject exclusion.
Next reconstruct a candidate transition inventory from raw setting records,
without requiring post-change ABG presence during candidate enumeration; then
apply eligibility using pre-change records and explicitly permitted intervention
information only. Search prior-use records beyond root indices before final
subject assignment. Endpoint availability is reported later, separately from
baseline qualification. Count all failures. No need for user action yet.

In parallel, complete fixed source-block, baseline-acceptance/drift, fitting,
training-only comparator and scoring specifications. These remain pending;
no arbitrary pH threshold introduced and no validation/pilot-ready claim made.
No further development-case parameter search. Production unchanged. Local
patient identity artifacts remain in restricted derived folders, not GitHub.
