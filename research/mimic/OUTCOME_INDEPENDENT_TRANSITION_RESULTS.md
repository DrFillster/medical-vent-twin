# Outcome-independent setting-change inventory - 2026-11-22

## Completed next step

Reconstructed FiO2/PEEP changes from vent_chart_events.parquet, not from the
supported-mode pool. Inspected extract_core.py: this source is a chart-item
extraction from raw MIMIC-IV 3.1 chartevents, without blood-gas/outcome selection.
No raw compressed chartevents reread was needed. No laboratory, outcome,
post-change availability, phenotype or fitted-gas data joined during enumeration.

Existing material-change extraction thresholds retained: 10 percentage points
FiO2 or 2 cmH2O PEEP. These are engineering inventory definitions, not clinical
recommendations. FiO2 fractions normalized to percent; PEEP unit must be cmH2O.
Exact duplicate timestamps collapse; contradictory/invalid blocks prevent
comparison both into and out of the block. No silent skipping across invalid
blocks. Prior setting must have been stored strictly before current charttime
for candidate retention. Current recording/recognition time retained separately:
retrospective detection is NOT a claim that an intervention was known in real
time at charttime. Equal-value duplicates with differing recording times are
handled conservatively using latest recording time. No maximum prior-setting
age or stable-exposure assumption added at inventory stage.

## Counts

- 318,781 material-change events across 32,827 subjects before candidate gates.
- After existing adult-stay/time membership, prior-setting availability and
  exclusion of all 286 mapped historical fitting subjects: 286,120 events
  across 32,176 subjects.
- FiO2: 189,933 events across 31,268 subjects.
- PEEP: 96,187 events across 17,467 subjects.

Subjects may occur in both item categories; category subject counts are not
additive. These are charted-setting candidates, not ventilated/pressure-support
eligible patients or an independently certified test cohort. FiO2 charting may
include other oxygen delivery; mode/airway eligibility remains to establish.
Existing adult_icustays uses anchor_age>=18: inherited age definition is
explicit and not newly validated as exact age at each encounter.

The prior observation of only six unused subjects concerned the old,
outcome-selected pool, NOT exhaustion of the underlying MIMIC setting records.
The new inventory resolves the data-supply concern at enumeration level.
Complete prior-use reconciliation beyond root fitting indices remains pending.
No post-change blood-gas values/times or outcome availability were inspected.

## Checks and reproducibility

Synthetic tests pass fraction/percent equivalence, duplicate collapse,
conflicting-block exclusions, invalid/wrong-unit block handling, and delayed
prior-recording flags. Full-data checker passes counts, event uniqueness,
patient exclusions, adult-stay timing, material-change/availability conditions,
and source SHA-256 hashes. Initial build hit DuckDB's parameterized CREATE VIEW
limitation before any data output; changed to CREATE TABLE, removed only the
verified-empty output directory and reran successfully. No source data modified.
Hashes recorded at completion, not claimed as prospective source freeze.

Patient data retained only in existing restricted derived storage. GitHub
contains code/tests and aggregate documentation only. Production and accepted
UI unchanged. No simulator fitting or new outcome scoring performed.

## Next bounded task

Apply pre-change invasive-ventilation/mode/source-block eligibility and baseline
measurement availability, using both charttime and storetime cutoffs. Report
all exclusion counts before fitting; do not require a post-change gas. Extend
historical-use reconciliation before final patient partition. Select patients
by a deterministic subject-level rule fixed before outcomes. Complete remaining
pilot fitting/acceptance/comparator/scoring rules; this inventory alone does
not authorize evaluation or reopen development-case parameter tuning.
