# Explicit-state batch results - 2026-11-20

## Completed implementation

Research adapter accepts explicit independent elastic/capacity/resistance scales,
recruitable fraction, effort profile/drive/muscle transmission and ventilation.
Requires evidence kind and source; rejects missing scales, invalid effort,
unsupported recruitment layout and missing provenance. Input objects not mutated.
Synthetic configurations are not diagnoses. Existing circulation/gas boundaries
remain reference-based, no patient gas fitting added here.

Eight coupled live-session smoke tests initialize and advance successfully:
baseline, higher resistance, higher elasticity, lower capacity, lower drive,
lower transmission, changed recruitment and explicit recruitment kinetics.
Mechanics and effort override application checked. Only four seconds of coupled
advancement tested per case; this is wiring/smoke coverage, not long-run stability
or clinical accuracy. Drive/transmission variants do not change endpoint volume
in this PC fixture; PS/spontaneous-effort dynamic effect tests remain required.

## Recruitment history tests

Sustained zero-flow history: low/high and reversed order yield distinct bounded
fractions; fresh repetition deterministic. Capacity floor protects elastic volume.
This history is NOT a replay of ordinary charted ventilator settings; do not
substitute set PEEP for sustained equilibrated alveolar pressure.

## Newly reproduced defect

Template thresholds are nested under compartment.recruitment. recruitmentRate
reads top-level P_open/P_close/k_open/k_close. Active mechanics and history pass
the whole compartment, so nested thresholds do not take effect in inspected path.
At probe distending pressure 24, nested opening threshold 22 produces rate zero
through current call (default opening threshold 25); passing nested parameters
explicitly produces positive opening rate. Changing nested threshold to 100 does
not change current call. Dedicated test reproduces this mismatch.

Production/shared engine NOT changed. Research adapter offers explicit kinetics
as opt-in and writes values to both locations; old behavior preserved otherwise.
This is parameter plumbing, not new evidence for the synthetic thresholds.
Production correction needs broader regression/provenance review and approval
under research/production separation. Do not claim legacy recruitment validated.

## Source inventory corrected

Earlier limited max-depth scan missed the nested raw source directory. Confirmed
local diagnoses_icd, diagnostic dictionary, labevents, inputevents and chartevents;
read headers only, no patient rows. Diagnosis table has no diagnosis timestamp;
retain retrospective annotation separately from prediction inputs. Input events
include start/end/store times; charts and labs include chart/store times.
No note/radiology/discharge filenames found under inspected raw release tree;
this is not a claim about remote source availability or user permissions.

## Batch verification

node research/mimic/test_state_control_batch.js

Five test programs PASS, including explicit known-defect reproduction. Pass
means expected current behavior observed, not all defects repaired. Existing
19-case fitting results unchanged, no patient outcomes read, no production edits.

## Next executable block

1. Timestamped source linkage and medication/context extraction for 19 dev cases;
   separate retrospective discharge diagnoses from pre-cutoff physiological inputs.
2. PS effort tests and longer coupled stability tests of explicit configurations.
3. Recruitment opt-in threshold behavior/regression comparison, not silent fix.
4. Select supported real patient configurations; no new statistical clusters.
