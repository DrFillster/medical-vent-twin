# Qualified development prediction engineering test

## Completed prerequisite

All five recovered fits have completed fresh 120-minute runs. Independent
checks: five hour passes, five descriptive extended passes, zero errors, zero
hour replay error. Hour-to-two-hour PaCO2 movements range about -0.065 to
+0.054 mmHg; PaO2 movements range -3.30 to -0.43 mmHg. One final pH residual
is +0.053. This remains reported without fitting a new pH parameter.
The original five successes have hour qualification, not fresh two-hour
confirmation in this experiment. Do not describe all ten as two-hour verified.

## Engineering design fixed before predictions

Ten selected development cases, two arms per case. Apply the recorded FiO2
change immediately after the existing initialization, or leave FiO2 unchanged.
No extra settling. Hold other ventilator settings and patient parameters fixed.
Sample 5-minute intervals through 60 minutes. Each arm starts in a new identical
session. Store pre/post FiO2, initial gases, fitted parameters and trajectories.
No outcome files, truth matching or patient outcome comparisons are performed.

Inputs, selected/excluded membership, source and runner content have a saved
manifest fingerprint. Changed context cannot resume in the same output folder.
All nine failed qualifications remain explicit exclusions. This is not an
independent validation cohort and does not establish clinical utility.

## Engineering checks before any scoring

Require all 20 arms and unique case/arm keys, finite states, identical initial
states and parameters within pairs, and fixed prediction horizons. Replay the
no-change hour endpoint against the prior qualified trajectory. A replay
mismatch is a blocker to interpretation, not a reason to tune the patient.
Report the changed-minus-unchanged model trajectory separately from measured
outcome error: one does not establish the other.

Runner: run_qualified_prediction_dryrun.js.
Auditor: audit_qualified_prediction_dryrun.js; requires full batch.
Outputs: derived/dev-qualified-prediction-v1/{manifest.json,predictions.jsonl,
engineering_audit.json}. Patient-level artifacts remain outside GitHub.

Prediction PID 55869; completion audit PID 56146. Do not start a second writer.
No frozen validation method is claimed until the engineering test and data
separation checks complete. GitHub publication remains previously blocked;
no alternate publication route is attempted. Runtime source unchanged.

## Separation audit limitation

Exact event-ID comparison finds zero overlap with four prior stored indices:
Freeze 3 development (140), original blinded (136), Freeze 2 (81), Freeze 3A
(12). This does NOT establish patient/stay independence, common event-ID
namespace, or historical outcome-access provenance. Those require a canonical
subject/stay/time bridge before any independent-validation claim. The current
19 cases have already been used for development fitting regardless of exact
index overlap. The new script itself has not opened patient outcomes.

Controller request semantics are next-completed-breath-boundary, not instantaneous
application. The design's immediate-after-initialization statement describes
request timing; controller application follows the existing runtime boundary.
The dry-run ledger does not save a separate applied-controller audit field.
This is an additional requirement before a formal predictive freeze.

## Completed paired engineering result

All 20 one-hour arms completed, zero errors. Independent auditor verifies ten
matched pairs, identical per-pair initial states/parameters, finite trajectories,
unique keys and the complete horizon grid. All ten no-change hour endpoints
reproduce saved qualification endpoints exactly. All ten modeled oxygen
responses have the same sign as the FiO2 change. This is within-model direction
consistency, NOT patient direction-of-change accuracy. No measured post-change
outcome was loaded or scored. Artifacts sealed with SHA-256 values in
engineering_completion_seal.json. No outcomes or excluded cases are discarded.

Modeled changed-minus-no-change oxygen responses span markedly different
magnitudes across patients. This is a result to test against patients, not
proof of correct phenotype-specific response. We have demonstrated an executable
and reproducible prediction path, not predictive accuracy or clinical validity.

Next blockers before formal validation: capture applied-controller evidence,
verify canonical patient/stay/time separation and historical outcome provenance,
freeze the final fitting/prediction method and scoring plan with baselines,
and preserve the exact source in approved version control. Current source is
uncommitted and publication remains blocked; do not bypass that boundary.
