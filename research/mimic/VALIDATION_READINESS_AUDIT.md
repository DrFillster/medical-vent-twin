# Validation readiness: applied settings and canonical identity

## Controller evidence completed

Fresh 30-second replay of each of the 20 qualified prediction arms. All 20
pass. Each observed-change request becomes active by the last checkpoint,
with no change pending, the exact requested FiO2, PS mode, and unchanged PEEP,
pressure support and backup rate throughout checkpoints. The ten no-change
arms retain original settings. One-second observations bound application time;
they do not identify the exact intra-second breath-boundary instant.

These are fresh short replays, not settings fields retroactively attached to
the original predictions. The original 20 trajectories remain unchanged. Save
applied settings in the future formal prediction ledger itself. Patient-level
records live in derived/dev-qualified-prediction-v1/applied_controller_audit.json.

## Canonical identity audit: overlap established

Earlier literal event-ID checks found zero overlap, but FIT and PSFIT IDs use
different namespaces. Canonical bridge uses subject, ICU stay, transition time
and intervention identity. All four prior indices bridge fully, zero missing
records; conflicting aliases cause a hard failure. Current 19 events represent
19 subjects, qualified ten represent ten subjects.

Among ten qualified cases:
- seven are the same canonical events as earlier Freeze 3 development cases;
- three are the same canonical events as original blinded cases;
- one shares a subject/stay with Freeze 2, though not the exact event;
- two are the same canonical events as Freeze 3A cases.

These overlap counts are NOT additive. They establish that the present ten
cannot be described as independent of all prior work. Prior outcome-access
provenance remains unresolved by identity linkage alone. The current audits
project identity/time columns only and do not open measured outcomes.

The earlier zero-literal-ID finding was narrowly true but insufficient. It
must not be carried forward as evidence of patient or transition independence.
Current fitting and prediction results remain valid engineering/development
artifacts, not independent validation evidence. No cases are dropped to improve
an apparent test result. Preserve all prior negative validations unchanged.

## Next design

Do not score the current ten as an independent primary validation cohort.
Freeze reusable fitting and prediction code, define a subject-disjoint test
set against the UNION of development and previously evaluated subject sets,
and verify historical outcome access before declaring it untouched. Carry
qualification failures into explicit coverage results. Specify persistence
and empirical comparators before evaluation; no further case-specific tuning.
Source version preservation is still blocked; do not bypass prior restrictions.
Production unchanged. No active fitting or outcome-scoring job launched.

## Independent union check

A second implementation using SQL EXISTS against the UNION of all four prior
indices confirms that ALL TEN qualified subjects were previously indexed in
at least one prior cohort. Per-index overlap counts must not be mistaken for
an untouched remainder. This is direct evidence against independent validation
using any subset selected merely by literal event ID or per-index exclusion.
It does not by itself establish which historical outcomes were read for each
subject. No outcome values were queried to perform this check.
