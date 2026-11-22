# Documentary cohort and baseline package - 2026-11-22

## Completed milestone

| Stage | Events | Subjects |
| --- | ---: | ---: |
| Previously established recorded exposure compatibility | 1,414 | not re-estimated |
| Conservative baseline-spanning device documentary support | 277 | 245 |
| After expanded review/fitting history exclusions, one event per subject | 241 | 241 |
| Provisional comparator training allocation | 199 | 199 |
| Provisional reserved test allocation | 42 | 42 |

No outcome-based selection, new patient fitting or scoring. No old development
patient tuning. Production and accepted UI unchanged. Patient data remain in
existing restricted derived storage; code/tests and aggregates on GitHub only.

## Device evidence

Explicit inspected vocabulary only. Two distinct fields from the same device
family must be positive strictly before earliest baseline measurement. ETT
family: size, location, mark, type; trach family: size/type. No same-family
explicit negative during baseline-to-change period; later nonpositive/unknown
value on supported fields blocks its family. Same-time conflicting latest
field values do not support a positive. Recent available records restricted
to four-hour pre-change window. Synthetic cases cover ordering, conflicts,
missing/late evidence, family separation and known trach vocabulary.

These conservative research rules do not prove uninterrupted airway presence
or clinical stability and are not a validated clinical classifier. They can
exclude real intubated patients with sparse documentation. Not applicable is
negative for its field, not a global declaration of extubation. Other source
fields/procedure evidence and cross-field contradictions before baseline still
need adjudication; two positives are documentary support, not final clearance.
Retain every assessment, including unknown/non-supported events. No lookback
widening to chase sample count. Numeric positive fields require known units
and positive value but do not independently establish anatomical plausibility.

## History and legacy identity resolution

Expanded designated review/fitting/phenotype inventory inspected identity
columns only in 13 tables: conservative union 500 historical subjects, removing
four of the 245 candidate subjects. Root and nested metadata checks previously
recorded are retained. Complete all-project prior-use certification remains
open for other repos/branches/undocumented history.

Resolved all 100 previously unmapped legacy EVT IDs by reproducing EXACT
row_number ordering from build_review_timelines.py over its existing
pilot_final_review_sample_100.parquet. Ordering keys have no ties. IDs cover
93 subjects; both legacy timeline and confounder identity columns map fully.
No additional overlap in the remaining 241 subjects. Legacy namespace is not
merged with canonical event IDs: identical strings are not universal identity.
No clinical timeline values or outcome columns read during reconciliation.
Source/sample generator hashes recorded. This closes the specific 100-ID gap,
not an assertion that no undocumented historical use exists.

## Deterministic provisional allocation

One earliest passing event per subject, tie-break by transition item and event
key. SHA-256('hummod-candidate-partition-v1:'+subject_id), first eight hex digits
modulo five: zero reserved_test, otherwise comparator_training. Rule fixed in
code before outcome access; no reshuffling for gas availability/response.
Historical overlap removed without reallocating remaining subjects. Sizes are
not a power calculation or claim of adequate validation precision. Final source
QC and protocol may further exclude; every exclusion must remain traceable.
Neither arm has been fitted or used for new comparator training in this batch.

## Baseline-only packets and checks

241 packets built from strictly pre-change charts and same-specimen arterial
gases, with mode text retained. Original v1 packet omitted text; v2 includes
it and is the current candidate payload. Both local versions retained for audit.
No post-change target values, target timing or target availability in packets.
Reserved baseline inputs accessed for deterministic QC only, not optimization.
Packet SHA-256: 54f50afbe138852874259be5b3345bce42301c3862e58d17b77ce1a8b686f1bf.

Checks PASS complete 1,414-event assessment ledger, documentary predicates,
277 supported events, earliest one-per-subject selection, deterministic hash
allocation, nested exclusions, legacy subject separation, source hashes, 241
packet identities, finite required numeric inputs, explicit supported-mode
text and pre-change gas recording times. Candidate-session and declared-
recruitment regressions pass. No claim of new physiological predictive accuracy.
Packet builder reads pre-change values only; checking positive/finite is not
full physiologic plausibility screening or parameter identifiability analysis.

## Next integrated milestone

Finalize source QC (including pre-baseline cross-field airway contradictions,
recording-order issues, duplicate specimen-time ambiguity and omitted airway
procedure evidence). Finish prespecified fitting/baseline-acceptance/drift,
comparator and scoring rules. Then use fixed fitting workflow, retaining
failures and hash-committing predictions before reserved outcomes. No ad hoc
acceptance cutoffs chosen to rescue these patients. Published phenotype
reproduction/availability remains separate pending work, not established by
this cohort package. The 241 are candidate patients, NOT 241 validated twins.
