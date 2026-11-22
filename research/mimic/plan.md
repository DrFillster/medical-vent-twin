# Active baseline-stability research plan

Branch: `research/baseline-stability-audit`

This is a scoped continuation plan, not a replacement for the locked validation
protocol. Keep shared v1.5, production physiology, and the live UI unchanged.

## Current bounded task

Audit the sequential acid-base nuisance fit before concluding that additional
patient measurements are required to explain the prior passing-control failure.
See `ACID_BASE_OPTIMIZER_AUDIT.md` for design, limitations, and results.

## Checks

- Reproduce the passing control with the default acid-base boundary.
- Test the existing paired CO2 / oxygenation parameter grid without new bounds.
- Confirm the selected pair over 60 minutes of unchanged ventilation.
- Keep pH residuals visible; do not quietly change the historical gas gate.
- Run synthetic scoring tests and the live-session regression suite.
- Commit source, aggregate interpretation, and this continuation plan only.
- Keep all patient-level input and output artifacts outside GitHub.

## Next decision

If the control remains unstable, isolate arterial-versus-venous initialization
and coupled steady-state behavior before introducing more free parameters.
If the control is recovered, test the other three development failures using
the same declared method before any cohort expansion or production merge.

Either result remains development evidence, not held-out validation. Preserve
existing locked cohorts and outcomes; do not tune from post-transition truth.

## Venous-state isolation continuation

Added a process-local paired initialization diagnostic and synthetic tests.
The default-SID original and alternative runs both pass the historical gas
gate. Four synthetic SID cases pass the exact venous-PCO2 preservation check
and unchanged arterial/oxygen-state assertions. The latent-SID pairs remain
to be interpreted after completion. See `VENOUS_INITIALIZATION_AUDIT.md`.

The earlier optimizer run completed: all 48 candidates executed, but its
selected candidate failed 60-minute CO2 stability. That result supersedes
any earlier pending language. The blocked GitHub publication remains pending;
no alternate publication route is attempted in this continuation.

## Completed venous-state chunk

Six trajectories completed. Default-SID invariance passed. Both latent-SID
configurations changed from historical gas-gate fail to pass when only venous
initialization was transformed. This reduces an early transient, not proven
long-term drift: the 60-minute pH endpoint remains effectively unchanged.
Next: add multi-timepoint trajectories and late-window slope checks on fixed
pairs before cohort expansion. No production merge or outcome unblinding.
See the completed-result section in `VENOUS_INITIALIZATION_AUDIT.md`.

## Timecourse diagnostic in progress

Added `diagnose_venous_sid_timecourse.js` to replay all six fixed configurations
at ten checkpoints without fitting new parameters. It reports early and late
changes and checks agreement with the original uninterrupted results. See
`VENOUS_TIMECOURSE_AUDIT.md`. No clinical or acceptance cutoff is added.
Synthetic initializer and optimizer tests pass; production diff remains empty.

## Completed timecourse chunk

Six trajectories at ten checkpoints reproduce prior endpoint values exactly.
Both initializations approach the same late gas state; the recovered historical
gate pass comes from reducing the early transient. This is not a repaired
steady-state model or validated intervention response. Full details and artifact
hash are in `VENOUS_TIMECOURSE_AUDIT.md`.

Next bounded task: fixed-parameter paired timecourses on the other three
existing development failures, separating target mismatch from early and late
drift. Preserve the locked gate and all held-out outcomes. No new validation
claim, production merge, or GitHub update has occurred.

## Three-failure matched diagnostic running

`diagnose_venous_sid_failure_timecourses.js` reuses the prior latent SID and
nuisance fit for each of three failed development examples, with both venous
initializations and ten timepoints. Each original replay must reproduce the
previous failure before comparison. No new fitting or outcome access occurs.
`test_venous_sid_failure_timecourses.js` checks the saved artifact, fixed pairs,
finite trajectories, and historical gate. See `VENOUS_FAILURE_TIMECOURSE_AUDIT.md`.

## Completed three-failure timecourse chunk

All six trajectories completed; three original failures replay exactly.
All three remain failures with either initialization. Case 1 primarily shows
an early CO2 transient while approaching its final target. Cases 2/3 retain
large final oxygen mismatch; low late slopes do not make those fits valid.
See `VENOUS_FAILURE_TIMECOURSE_AUDIT.md` for checks and artifact hash.

Next bounded task: oxygenation-capacity sweep for cases 2/3 using the existing
ventilated-perfusion grid, fixed SID and CO2 nuisance, unchanged ventilation,
and no outcome access. Evaluate early and settled oxygen-target errors
separately. Keep case 1 as a separate initialization task. No gate relaxation,
production merge, or validation claim. GitHub publication remains pending.

## Larger oxygenation diagnostic chunk

Running 16 full-hour candidates: two oxygen-failure cases, all eight existing
perfusion grid values, fixed prior SID and dead-space nuisance. No new bounds.
Prepared independent 120-minute follow-up at each case's best final-oxygen
candidate, with model gas-exchange, hemodynamic, and mechanics diagnostics.
Selection is oxygen-only; full historical gate remains separately reported.
Prepared artifact tests for grid coverage, fixed inputs, finite outputs,
selected-candidate replay and applied perfusion. See `OXYGEN_CAPACITY_AUDIT.md`.
A fresh live-session regression suite is also running. No production changes.

## Completed larger oxygenation chunk

Completed 16 original-grid hour trajectories, two best-original-candidate
120-minute checks, and two bounded midpoint hour trajectories. Original-grid
passes: zero. Midpoint passes: both. This identifies coarse-grid fitting loss
in the two examined oxygen-mismatch examples, without new physiology or bounds.
Extended coarse-grid failures remain wrong despite additional settling.
Fresh session regressions: 17 pass, zero fail. All three new artifact tests pass.

Do not confuse the successful hour-midpoints with the extended coarse-grid
runs: the midpoints still need fresh 120-minute confirmation and local
robustness checks. Nonzero pH residual and one near-cutoff CO2 drift remain.
Next chunk: that confirmation/fragility test, not production deployment.
Case 1 retains a separate initialization problem. Preserve original failures,
locked acceptance gate and held-out outcomes. Audit and hashes are in
`OXYGEN_CAPACITY_AUDIT.md`. GitHub publication remains pending; local HEAD
remains `b156429fd0857cdf5cbc5047111dae1054bc109f`.

## Midpoint confirmation and fragility chunk

Running six 120-minute trajectories: each successful midpoint at original
perfusion and absolute offsets +/-0.005, with all other inputs fixed.
Hour gate remains historical; two-hour extension is descriptive only.
No pH pass criterion is introduced. Patient-level artifacts stay outside git.
`OXYGEN_MIDPOINT_ROBUSTNESS.md` records the declared design.
`DEVELOPMENT_FITTING_V2_SPEC.md` is a candidate method specification only,
not an implemented fitter, active protocol, or authorization to change the
locked validation. Midpoint robustness results remain pending completion.

## Completed midpoint robustness chunk

Six two-hour runs completed. Both fitted centers pass and reproduce the hour
results exactly. Case 2 passes both +/-0.005 offsets. Case 3 passes -0.005 but
+0.005 fails the early oxygen gate despite acceptable final oxygen error.
Five of six historical-hour and descriptive-two-hour gates pass. This isolates
local early-gate sensitivity, not late gas instability. No pH retuning.
Artifact and prior seven synthetic/artifact tests pass; production diff empty.

Next: implement a reusable bounded bracket-refinement development fitter with
full attempt logging and coupled gas reevaluation; do not continue adding
case-specific scripts. Retain case 3 sensitivity failure and case 1 unresolved
initialization. `DEVELOPMENT_FITTING_V2_SPEC.md` remains candidate planning,
not an active validation protocol. See `OXYGEN_MIDPOINT_ROBUSTNESS.md` for
completed results and local artifact hash. No GitHub publication occurred.

## Completed reusable bounded-refiner chunk

Implemented pure deterministic `bounded_perfusion_refiner.js` with finite
input validation, bounded sign-bracket bisection, coupled historical gate,
explicit stopping statuses/budget and complete attempt/error retention.
17 contract tests pass. Generic model regression reuses the existing eight
seeds and independently simulates each newly requested candidate for an hour.
Both oxygen cases select their prior midpoint in one evaluation, nine retained
attempts each, with zero replay error. Independent artifact tests pass.

This is a component plus development regression driver, not cohort integration.
Do not claim a full active v2 fitter, new validation, or production deployment.
Prior Case 3 perturbation failure remains and Case 1 initialization is unresolved.
Next: development-only configurable runner with seed-context fingerprints and
path configuration; then source-consistent Case 1 initialization. Details in
`BOUNDED_REFINER_AUDIT.md`. Held-out outcomes and runtime source unchanged.
GitHub publication remains pending the prior blocked update.

## Cohort pipeline consolidation launched

Extracted the shared development adapter and implemented configurable,
fingerprinted, resumable `run_development_batch.js`. The input audit found
22 prior rows mix 19 locked composite events with three history cases. Use
the 19-case composite denominator; five history cases in the 24-event lock
remain a separate pathway. Do not report the mixed 22 as one composite cohort.

Full 38-run baseline comparison launched (original/candidate for every case).
No perfusion/deadspace retuning in this stage. The candidate combines latent
SID and alternative venous initialization, not an isolated-effect comparison.
Every result/error is checkpointed with input/source hashes. Partial-batch
integrity and foreign-context rejection tests passed. No final cohort result
claimed yet. Completion-check/report process is launched and refuses partial
results. Artifacts stay in derived/dev-batch-baseline-v1 outside git.

Next: inspect complete paired improvements/regressions, original replay
mismatches and failure components; then choose a single declared batch fitting
step. No more case-specific scripts unless cohort evidence requires one.
See DEVELOPMENT_BATCH_RUNBOOK.md. Truth and production untouched. Publication
of local work still pending the prior blocked GitHub operation.

## Complete baseline cohort and refinement batch launch

All 38 baseline runs completed, zero errors. Original and candidate each pass
5/19, same five; zero improvements or regressions. Original classifications
reproduce exactly. Candidate failures overlap: baseline CO2 4, CO2 drift 7,
baseline O2 6, O2 drift 1. This is not a cohort rescue. Full parent artifact
integrity tests pass; original 22-row mixed scope is not used as denominator.

Implemented and launched `run_cohort_perfusion_refinement.js` across all 14
candidate failures, preserving five inherited passes. Each failure gets the
existing eight-point perfusion grid at full hour and at most four refinements.
SID, deadspace, effort/mechanics and ventilation fixed. New manifest verifies
parent ledger, inputs and runtime/source fingerprints. Every attempt cached
for exact-context resume; errors/failures retained. Early ledger integrity
checks pass; no completed cohort refinement result yet. PID 11055.

Outputs: derived/dev-cohort-perfusion-v1/{manifest.json,attempts.jsonl,summary.json}.
Summary appears after the first complete case. To resume, use identical runner
with --data-dir derived --parent-dir derived/dev-batch-baseline-v1 --out-dir
derived/dev-cohort-perfusion-v1 (full absolute paths). Do not run a second writer.
Next: verify all 19 decisions and report inherited versus newly recovered
passes, unresolved mechanisms and final residuals; no case-specific patches.
See COHORT_BASELINE_RESULT.md. Locked validation/outcomes and production remain
unchanged. Publication still pending prior blocked GitHub update.

## Completed full-cohort failure audit and first four bounded searches

Full 19-case diagnostic partition: five historical passes; four historical
failures with final gas errors within descriptive 8/20 comparators; six final
oxygen mismatches; four final CO2 mismatches. No altered gate or clinical
validation claim. Failure partition independently tested and saved outside git.

First four original failures completed 40 new full-hour candidate simulations:
one recovered, two budget exhausted with CO2 failures, one no oxygen bracket
at fixed other inputs. Two parent passes inherited; six case decisions done.
Recovered fit CO2 drift 7.72 is near 8 cutoff; no robustness claim. Remaining
refinement cases continue in PID 11055. Final completion auditor/report PID
12293 waits then validates all 19 decisions before writing final cohort report.
No extra model fitting is authorized by that completion reporter.

`COHORT_FAILURE_MODE_FINDINGS.md` records actual completed findings and limits.
`report_cohort_refinement.js` is ready, refuses partial results. Next inspect
completed cohort and decide a single next development design, not case patches.
Parent integrity, candidate ledger bounds/gates, 17 search contracts, prior
model regression and six sensitivity-trajectory checks pass. Runtime source
unchanged, truth unopened. GitHub commit/publication still not performed.

## Complete perfusion cohort: 10/19 qualification

All 140 fresh full-hour candidate runs finished without execution errors.
Five recovered plus five inherited passes = 10/19. Nine unresolved: six search
budgets exhausted, three no oxygen bracket. All-140 attempt integrity test passes.
At closest-O2 candidates, seven unresolved cases retain CO2 gates and two retain
oxygen gates. This is descriptive selection, not identified biological cause.
Production and outcome truth remain unchanged. See COHORT_REFINEMENT_COMPLETED.md.

Fresh confirmation launched: five selected new fits, each 120 minutes, no
retuning, hour replay assertions and descriptive extended gates. PID 55002.
Output derived/dev-cohort-perfusion-v1/recovered_120min.jsonl; design fingerprint
in confirmation_design.json. Never launch duplicate confirmation writer.
Next: independent audit after five rows, report final errors and extended
failures; decide frozen narrow prediction experiment without forcing all
nine failures through new fitting. Not a validation claim. Local publication
remains pending; no claim of a committed/pushed result.

## Two-hour confirmation complete; paired prediction engineering test active

All five recovered fits completed 120-minute replay without errors. Independent
audit verifies five historical-hour passes, five descriptive extended passes,
exact hour replay, final errors and late changes. No further tuning. Original
five successes are hour qualified, not newly two-hour verified.

Started run_qualified_prediction_dryrun.js across ten qualified development
cases, observed FiO2-change and no-change arms (20 total), fixed settings/params,
5-minute samples to 60 minutes. Manifest fixes source/input hashes and all nine
excluded IDs. Prediction PID 55869; completion auditor PID 56146. First eight
pairs complete with zero execution errors at last read. Auditor contract tests
pass for complete/partial/duplicate/replay-mismatch/error synthetic fixtures.

No outcome-value file opened. Exact event-ID overlap with four prior indices
is zero, but canonical ID, subject/stay independence and past access provenance
are NOT established. Current cases are development-selected regardless; no
independent validation freeze claimed. Source request applies at the next
completed breath boundary. Applied-controller evidence is not saved separately
in this engineering dry run and is required before formal freeze. See
QUALIFIED_PREDICTION_DRYRUN.md. Production untouched, GitHub publication blocked.

Next: await all 20 predictions, inspect engineering_audit.json for no-change
endpoint replay, paired finite trajectories and changed-minus-unchanged gas
response. Preserve results; no retuning or patient outcome scoring in this run.

## Paired prediction engineering complete

20/20 arms complete, zero errors. Ten matched pairs, all finite and fixed
horizons; identical parameters/initial states within pairs. Ten no-change
hour endpoints replay qualification exactly. Modeled oxygen-change sign
matches FiO2-change sign in all ten pairs, NOT patient direction accuracy.
Engineering artifact seal stores content hashes. Patient outcomes still not
loaded by this run. Production unchanged, code uncommitted/publication blocked.

Next work is validation readiness, not more baseline fit scripts: applied
controller logging, canonical subject/stay/time separation/provenance, frozen
scoring and baseline comparisons, version-controlled source via approved path.
Do not claim the 10 selected development fits are an independent test cohort.
Detailed result: QUALIFIED_PREDICTION_DRYRUN.md. No active batch remains.

## Readiness audit: controller passes; canonical cohort overlap found

Implemented audit_applied_controller.js; all 20 fresh 30-sec replays verify
active requested FiO2, no pending change by 30s, invariant PS/PEEP/support/backup
rate. Original prediction files unchanged. Capture application in future ledger,
not retroactively relabel prior trajectories as controller-instrumented.

Implemented audit_canonical_cohort_separation.py, identity/time columns only.
502 alias bridge entries; all prior index IDs resolve. Qualified ten overlap
canonical events with Freeze3 dev seven, original blinded three, Freeze3A two;
Freeze2 has one shared qualified subject/stay but no same qualified event.
Counts overlap, not additive. Earlier zero literal-ID result cannot establish
separation because FIT/PSFIT namespaces differ. Patient outcomes not opened.

All present ten remain development, not independent validation. Next construct
subject-disjoint test membership against union of development/evaluated subject
sets and verify access history before formal freeze. Do not selectively drop
known overlap and call remaining cases untouched. Preserve all nine failures.
See VALIDATION_READINESS_AUDIT.md. Publication still blocked; production untouched.

Independent SQL UNION-subject check: all ten qualified subjects previously
appear in at least one of the four earlier indices. There is no untouched
qualified remainder under that union. Controller/pending-state independent
checks pass all 20. No batch running; next is truly subject-disjoint cohort
construction/provenance, not outcome scoring of these ten as validation.

## Phenotype layer accepted; availability inventory complete

User requested GitHub update and continued phenotype work. Added
PHENOTYPE_PLAN.md and build_phenotype_availability.py. All 19 cases retained:
PaO2/FiO2/PEEP/PaCO2/pH/PS/mode present in prefits 19; minute volume 18;
tidal volume 18; total rate 15. Records carry source, explicit timing/quality
limitations and missing versus not-extracted status. No disease labels,
clinical score arithmetic, derived dead-space or latent-fit circularity.
Patient artifacts stay outside git in derived/dev-phenotype-v1.
Next: timestamp/source-window audit and expansion of pre-change context,
then coverage comparison and phenotype-informed development design. No truth
access or production change. Fresh normal GitHub publication attempt follows
user's explicit update instruction; no alternate route if it is denied.

## GitHub publication restored

Normal git commit/push succeeded on research/baseline-stability-audit at
5cc3834, preserving the accumulated 53 source/document files. This supersedes
all earlier pending/blocked publication status; historical notes are retained.
No production merge. Patient-level artifacts remain outside the repository.
Phenotype inventory independently checked: all 19 unique records, every group
availability count, explicit unknowns and no fitted-feature circularity.
Next bounded chunk: source timestamp alignment and raw pre-change context
extraction, not disease labeling from incomplete prefits.

## Approved aims adopted; Terry reproduction gate started

Saved user-approved text as SPECIFIC_AIMS_2026-11-20.md. Only Terry first-day
two-cluster classifier; cluster adequacy remains an empirical question, no new
phenotypes. Individual continuous measurements remain in each patient's fit.
Main paper checked; wrote TERRY_REPRODUCTION_GATE.md with exact preprocessing,
centers/imputation and timing prerequisites. PMC download was HTML; alternate
Europe PMC supplement ZIP retrieved successfully, contents await inspection.
No assignments made; published deployable artifacts not yet verified.

Expanded availability audit from transition-time manifest: SpO2/FiO2/PEEP/HR/MAP
19, minute ventilation/observed VT 18, lactate nine, plateau and bicarbonate
zero in current manifest. These are NOT first-24h availability estimates and
must not justify excluding patients or imputing source values. Next inspect
supplement, establish final retained features/transformations/centers and raw
first-day extraction. No outcome values read, model parameters unchanged.

## Supplement inspected; substantive two-cluster and timing findings

TERRY_SUPPLEMENT_FINDINGS.md records source hash and verified findings.
Day-one NBClust most often selected THREE; authors retained TWO for parsimony
and agreement across time windows, supported by other diagnostics. Do not
claim unanimous evidence for two groups. No numeric deployable centers/scaler
identified; package names and cluster medians cannot replace the original
model. Author artifact request prepared, not sent. Encounter-level preprocessing
raises prospective leakage question needing clarification.

Implemented and ran audit_terry_temporal_readiness.py: nine of 19 development
transitions before 24h from earliest InvasiveVent status; ten at/after. These
are provisional ICU-status anchors, not confirmed hospital/intubation anchors.
Synthetic regression test PASS: boundary equality, early/unknown/before-start,
explicit limitations, duplicate rejection and overwrite protection. Patient
records remain outside GitHub; no outcome values read; no labels or new fitting.
Milestone remains partial: author artifacts, true first-day extraction and
historical-use-complete independent cohort are outstanding.

## Public-only Terry check concluded

See TERRY_PUBLIC_REPRODUCTION_DECISION.md. All 25 supplement tables and
OOXML members checked; custom XML is empty bibliography, no embedded model.
No public Terry repo located in targeted GitHub/web searches. Publisher extra
files unverified because HTTP 403. Original classification not reproducible
from inspected public materials; no-new-clusters constraint maintained.
No outreach; author request remains unsent and is not a next action.

## Phenotype utility experiment specified

See PHENOTYPE_UTILITY_EXPERIMENT_PLAN.md. A: no-label individual fitting;
B: same predictions stratified by label; C: group-informed soft priors with
identical patient inputs/bounds/compute budget. No new clusters. Label-only
audits separate from parameter inference. Development first, then immutable
patient-disjoint evaluation; classifier public-artifact blocker remains.

## Disease controls and first evidence records

Current live research path guarded to one moderate aspiration reference case;
individual mechanics/effort/gas overrides exist, not broad diagnosis-driven
state selection. All cases share recruitment initializer and nominal awake
profile, latter overridden for drive/transmission. Do not imply these labels
are verified patient diagnoses or awake-state observations. Source wiring
inspected; control perturbation tests remain pending.
Built all 19 source-linked fit/assumption records; explicit disease evidence
unreviewed and source timestamps unverified. Independent exact-membership and
limitation assertions PASS. No diagnoses assigned, no outcomes read or physiology
changed. See DISEASE_CONTROL_AUDIT.md. Next: timestamp and authorized-source
inventory, evidence-contract tests, then control sensitivity checks.

## Multi-state capability matrix completed

See MULTISTATE_CAPABILITY_MATRIX.md. Key finding: stiffness scaling also
changes capacity; chest-wall fraction fixed at 0.25; recruitment normal and
consolidated states constrained. Expiratory solver exists but obstruction
behavior not yet demonstrated. Next isolate controls in research tests,
then select MIMIC examples with timestamped clinical evidence. No production
changes or diagnosis assignments.

## Isolated controls executed

Added independent_mechanics_controls.js and synthetic tests; baseline and
legacy parameter equivalence pass. Resistance/stiffness/capacity separate
changes all affect outputs. See ISOLATED_STATE_CONTROL_RESULTS.md. Summary
peak pressure zero in PC tests; unresolved readout blocks pressure-based
calibration. No patient reads or production edits. Next inspect pressure
provenance then obstruction/recruitment tests and live research configuration.

## Pressure provenance and nine expiratory tests completed

Research readout resolves zero peak by selecting completed delivered breath;
production unchanged. Nine passive PC fixtures with explicit expiratory holds
show higher total PEEP with rate/resistance; monotonic and missing-breath tests
pass. Not a validated COPD disease state. See EXPIRATORY_STATE_CONTROL_RESULTS.md.
Next recruitment/history checks and explicit research live-state adapter;
setting-change freshness needed before wrapper used in patient transitions.

## Larger explicit-state batch completed

Added explicit_patient_state_adapter.js and batch runner. Eight synthetic
coupled configurations initialize/advance; source and control contracts enforced.
Recruitment/history checks pass but reveal ignored nested kinetics in legacy
path; dedicated mismatch reproducer added, opt-in top-level plumbing in research
adapter only. Production unmodified. Corrected raw inventory finds diagnosis,
lab, input and chart source files in deeper directory. Headers only; no patient
rows read. Next 19-case timestamped extraction, PS effort and longer stability
runs. See EXPLICIT_STATE_BATCH_RESULTS.md for exact scope and limitations.

## PS and pre-change source audit executed

Four 60-second coupled PS configurations pass controls/finite-volume checks.
Audited 247 field checks across all 19 dev cases: 63 matching strictly available
candidates, seven late/unknown-store matches, 75 missing, 102 no strict match.
Do not interpret as exact source verification or patient counts. Original
extractor includes equal charttime and no storetime cutoff; review required.
Synthetic 19-case provenance test PASS; no post-change outcomes read. Next
dictionary verification, exact source reconstruction, labs/settings and context.
See PS_AND_SOURCE_AUDIT_RESULTS.md.

## Disease context and exact source reconstruction completed

19 development cases linked to retrospective code titles (453 rows), excluded
from fitting inputs. Inclusive legacy source selection reproduces all 247 fields;
114 present sources charted at transition, 49 strictly available; four timestamp
ties. Strict earlier packet has 112 raw sources/110 unambiguous time/type-gated
fields; not prediction-ready. Resistance variants/compliance units require review.
Latest complete ABG raw components strictly available in 18/19 cases; target value
agreement still pending. Four PS configs ran 600 seconds with finite-volume checks,
not long-term clinical stability proof. See DISEASE_CONTEXT_AND_SOURCE_RESULTS.md.
Next setting provenance, lab target matching, medication context, clinical review.

## First similar-settings patient experiment executed

Four exact starting-setting groups, nine existing dev cases; 18 fresh paired
60-second runs, zero errors. Three previously qualified, six baseline failures
retained. Outcome window fixed before reading new outcomes; three with gases,
one with qualified saved prediction and observed gas. Development outcomes
now explicitly unblinded. No accuracy claim; post-change confounders pending.
See SIMILAR_SETTINGS_DEVELOPMENT_RESULTS.md. Next physiological/time-valid
matching rather than settings-only equivalence; independent cohort untouched.

## 2026-11-21 exact-time similar-case replay complete

Six fresh paired runs in three cases with previously inspected development gases;
explicit-state options at legacy-equivalent values, no retuning. Exact specimen
time alignment and initial-gas equality pass. One qualified and two failed
baselines retained; failed cases have poor CO2 agreement, no uniform oxygen
benefit from recorded-change arm. No clinical accuracy claim. First strict
parameter-equality attempt stopped for last-bit arithmetic mismatch; v2 tolerant
parameter contract completed. All nine setting timelines audited; no recorded
strictly later divergence, not proof of no cointerventions. Three medication
contexts scanned; two overlapping input records in one case, no later starts;
selected inputevents only, incomplete medication reconciliation. See
EXACT_TIME_SIMILAR_CASE_RESULTS.md. Next pre-change-only independent mechanical
fitting for failed baselines, not fitting to inspected outcomes. Production and
independent test cohort unchanged.

## 2026-11-21 strict-input independent mechanical search complete

Fresh packets across 19: four satisfy strict pre-change setting/mode/lab-time
requirements; 15 source-history exclusions, not fitting failures. All 19 have
available complete arterial gases under matching raw component rule. Missing
mode source main bottleneck; alternate Hamilton item not implemented here.
352 mechanical search simulations plus four fresh ten-minute confirmations;
zero execution errors. Three selected sets pass engineering mechanical screen
and confirmation, fourth fails timing. Multiple acceptable configurations in
all three passing cases: not identified disease states, not gas qualification,
not improvement claim over old 10/19. No old prefits or outcome files read.
See TIME_VERIFIED_MECHANICAL_FIT_RESULTS.md. Next co-temporal context review,
retain candidate ensembles for pre-change gas qualification, joint drive search
for failed timing case. Production and independent cohort unchanged.

## 2026-11-21 ensemble confirmation and joint timing search complete

36 unique prior acceptable configurations (deduplicated from 37 passing
attempts) all pass fresh ten-minute mechanical screen. Fourth-case joint
seven-drive x 81-control search completes 567 short runs; 28 pass, selected
best also passes fresh ten-minute run. Total 604 fresh simulations, zero
execution errors. All four now have an engineering mechanical fit, not gas
qualification. 37 long-replay configurations retained; other joint short
alternatives preserved unconfirmed. Context audit: three cases have matching
recorded settings at/before all measurement samples; one has earlier MV
without documented PS at that sample, not authorized for gas fitting yet.
Same-time entries retain ordering ambiguity; no clinical alignment implied.
See MECHANICAL_ENSEMBLE_AND_ALIGNMENT_RESULTS.md. Next reconstruct compatible
blocks, then pre-change gas fitting with mechanical rechecks and ensembles.
No outcome files read by this batch, production/independent cohort unchanged.

## 2026-11-21 provisional pre-change gas ensemble screen complete

Three recorded-context-matching cases, 31 retained mechanical configs; fourth
case withheld for PS-at-MV context. 279 short gas-grid simulations plus three
fresh ten-minute confirmations, zero execution errors. One case meets joint
O2/CO2/mechanics endpoint limits, two fail gas limits; all three preserve
mechanical screen at confirmation. Passing gas case has material pH mismatch:
NOT full baseline qualification. Reference SID not fitted; pH not optimized.
No old fitted gas parameters/post-change outcome files read. Source alignment
remains provisional; no clinical adjudication implied. See
PRECHANGE_GAS_ENSEMBLE_RESULTS.md. Next acid-base state/parameter initialization
review and bounded gas refinement with mechanical rechecks. No threshold
relaxation, no claims of improved old 10/19 coverage. Production/test untouched.

## 2026-11-21 strict acid-base paired review complete

Initializer source audit corrects prior wording: measured pH input is diagnostic,
not directly imposed at fixed SID. Three fitted SID values reproduce original-
initializer initial pH, but free evolution still drifts. Nine long paired
reference/fitted/corrected initializer runs, 21 local gas refinements and three
long confirmations: 33 dynamic simulations, zero errors. Mechanical screen
preserved in all three refined confirmations; one O2/CO2 pass, no full baseline
qualification. Pure initializer invariants do not imply bitwise identical
session-level outputs; initial checker assumption failed and was corrected,
data retained. Existing research venous-PCO2 correction does not rescue failed
long endpoints here. See STRICT_ACID_BASE_REVIEW_RESULTS.md. Next audit CO2
pool/ventilation/metabolic and oxygen/perfusion balance plus early/late slopes,
not force baseline fit with extra parameters. No production/test changes.

## 2026-11-21 fixed-parameter 30-minute gas-balance audit complete

Three fresh unchanged-support runs, 183 raw exchange/boundary/state samples,
finite outputs and prior 600-second confirmation agreement. First/third trends
near plateau away from targets; second continues CO2 accumulation and acid-base
mismatch. Fixed reference metabolic O2/CO2 inputs used for all three, not patient
measurements. Late O2 uptake near demand does not ensure matching arterial O2.
Sparse instantaneous rates not mean balance or whole-body conservation proof;
reduced state lacks explicit volume-weighted whole-body inventories. See
STRICT_GAS_BALANCE_AUDIT_RESULTS.md. Next long-horizon fitting across retained
ensembles, metabolic source/units and data-availability audit before extra freedom.
No retuning, post-change data, production changes or independent cohort use.

## 2026-11-21 long-horizon mechanical ensemble complete

31 ten-minute retained alternatives at fixed prior case gas fractions/SID,
three fresh thirty-minute winner replays: 34 runs, zero errors. All preserve
terminal mechanical screen; 14 candidate O2/CO2/mechanical passes, one selected
thirty-minute O2/CO2 pass. First-case final pH/CO2 substantially closer than
short-selected predecessor; second CO2 and third O2 failures remain. No full
baseline/pH/cardiovascular qualification assigned. Input/new-runner hashes
recorded before runs. See LONG_HORIZON_ENSEMBLE_RESULTS.md. Unit audit finds
consistent inspected CO2 scaling, no thousand-fold defect; metabolic defaults
not patient measurements. Next bounded long-horizon gas-fraction search with
fixed priors and multi-checkpoint mechanics, not expanded metabolism freedom.
Production and independent cohort unchanged; no post-change outcomes read.

## 2026-11-21 final bounded development search closed; freeze gate explicit

27 ten-minute gas candidates + three fresh thirty-minute confirmations, zero
errors. Multi-check mechanics pass all three selected cases; one O2/CO2 pass,
two gas failures retained. Development tuning stops; do not start another
parameter search. Recruitment path IS affected: missing explicit kinetics
falls back to defaults rather than template; new regression confirms selected
path and explicit-template option difference. Next correct research kinetic
path and paired replay, not patient parameter retuning. Freeze candidate is
NOT locked: source-block rules, pH/drift acceptance, comparator implementation,
patient-disjoint prior-use checks and scoring still required before test-label
access. See FINAL_BOUNDED_GAS_RESULTS.md and PREDICTION_PILOT_FREEZE_GATE.md.
Production and independent cohort unchanged, no outcomes read by this batch.

## 2026-11-21 declared recruitment research correction replay complete

Added opt-in declared_recruitment_options.js, unit tests and hashed-source
paired replay. Three saved cases x legacy/declared x unchanged/synthetic FiO2
step: 12 runs, zero errors, fixed fits; 1800s baseline +300s observation. Source/
input hashes, pre-step identity and legacy baseline reproduction all pass.
Recorded gas/mechanics checkpoints identical between wiring arms in these
conditions; baseline gas failures unchanged. Rate probes confirm intended
kinetics now effective, but no claim of general defect harmlessness or PEEP
validation. Production and legacy runners untouched. Next explicit candidate
pilot integration and remaining freeze gates, not more patient tuning.

## 2026-11-21 candidate session integrated; existing pool nearly exhausted

Candidate session imports corrected kinetics and research initializer in fresh
worker; smoke/input/import-order tests pass. Review contract rejects missing
fields but is not evidence verification; no completed lock/scoring authorization.
Identity-only conservative audit finds 502 historical events/286 subjects;
root index IDs all mapped. Existing pool 411 events/292 subjects leaves six
events/six subjects outside mapped fitting history, NOT six qualified independent
patients. Existing pool has downstream selection dependency. Full prior-use
ledger beyond root indices still needed. Next outcome-independent raw transition
inventory + pre-change eligibility, not reuse old blinded labels. No outcomes
read, production changed or development patients retuned. See
CANDIDATE_PILOT_INTEGRATION_STATUS.md. Patient identities not published.

## 2026-11-22 outcome-independent candidate setting inventory completed

Rebuilt from raw-item-only chart extraction, no old supported-mode/outcome pool
or lab joins. 318,781 material setting changes/32,827 subjects; after existing
adult-stay/time, prior-setting availability and mapped historical exclusions:
286,120 events/32,176 subjects. FiO2 189,933; PEEP 96,187. These are candidates,
NOT qualified ventilated patients or a certified test set. Prior six unused
subjects applied only to old outcome-selected pool. Synthetic and full-data
contracts pass timestamps/conflicts/duplicates/units/counts/exclusions/hashes.
No outcomes read, no fitting, production unchanged. See
OUTCOME_INDEPENDENT_TRANSITION_RESULTS.md. Next strict pre-change airway/mode,
source-block and baseline data eligibility plus expanded historical-use audit;
no post-change gas requirement and no restart of development patient tuning.

## 2026-11-22 pre-change input availability screen complete

286,120 setting events -> 11,641 chart-input events/5,781 subjects -> 5,448
complete available arterial gas + chart events/3,427 subjects. Sequential
exclusions recorded. Only pre-change chart/lab rows with pre-change storetime;
no post-change endpoint requirement. Initial exact mmHg-string bug yielded zero;
corrected mm Hg normalization in separate v2 artifacts, old data retained.
Synthetic specimen SQL + full-data contracts pass. This is availability, NOT
invasive airway/source-block eligibility or fitting qualification. Airway fields
absent from current extract; next retrieve device evidence and align exposure
blocks, extend history and define subject split. Production unchanged, no fit
or outcome scoring. See PRECHANGE_CANDIDATE_SCREEN_RESULTS.md.

## 2026-11-22 candidate airway/exposure documentary audit complete

Existing raw-item airway extraction found/verified, no raw reread. Among 5,448
input-complete candidates, 1,414 satisfy strict earlier-setting support for all
four measurement/four setting combinations without documented intervening
conflict. Narrow recent Oral/Nasotracheal field present in 62 events; both
screens in 20 events/17 subjects. NOT qualified cohort: narrow route field
misses other device evidence and does not prove airway span or clinical steady
state. Synthetic/full-data checks pass, outcomes/fitting untouched. Next broader
ETT/trach field extraction from verified dictionary plus contradiction handling,
then complete prior-use and partition. Do not discard all unlabeled candidates
as noninvasive. See CANDIDATE_EXPOSURE_ALIGNMENT_RESULTS.md.
