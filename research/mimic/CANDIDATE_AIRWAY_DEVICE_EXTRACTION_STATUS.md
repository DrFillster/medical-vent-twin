# Broader candidate device extraction checkpoint - 2026-11-22

## Implemented and running at this checkpoint

Raw chartevents.csv.gz (3.3 GB compressed) scanned once for eleven locally
verified d_items entries: airway type, ETT size/location/mark/type/position/
route, trach tube type/size, newer airway location/size. Output restricted by
EXISTS to 1,414 exposure-compatible event windows: same subject/stay, four-hour
lookback, both charttime and storetime strictly before each change. No raw
uncompressed copy, full airway table or outcome table created. SQL physically
streams raw chart records but retains only requested device fields/windows;
no post-change outcomes selected or used. Existing narrower artifacts intact.

Extraction started in process 41776. Consult derived/candidate-airway-devices-v1/
manifest.json for machine-readable completion status. Do NOT infer completion
from existence of device_events.parquet: a zero-length/incomplete file can
exist while COPY is running. Do not report final counts before summary exists
and check_candidate_airway_device_extract.py passes. No restart or second
concurrent raw pass needed. Memory limit 2 GB; disk availability checked (17 GiB
free) before run. Restricted output remains in existing local derived storage;
no patient records on GitHub. Source size/mtime recorded, not a raw SHA freeze.

## Tests and pending coverage inventory

Synthetic device-window test passes pre-change availability, exact lower window
boundary, delayed/same-time exclusions and subject/stay isolation. Syntax checks
pass. Full-data checker implemented for completion marker, row counts, allowed
items, per-record containment in at least one candidate window and unchanged
raw metadata. It is not yet a clinical adjudication test.

inventory_candidate_device_coverage.py can run ONLY after completion. It counts
field availability, including negative/ambiguous field values. Counts are NOT
positive device classifications, and overlapping categories must not be added.
Clinical evidence rules and contradictions must be reviewed after the actual
pre-change value vocabulary is inspected. No nearest-label inference. Evidence
must ultimately span baseline measurement times; a recent field alone is not
proof of continuous invasive exposure.

## Additional completed historical metadata audit

13 nested dev-*/manifest.json files inspected, only explicit identity arrays.
Six contain recognized identity arrays. They resolve to three subjects already
inside the canonical exclusion bridge, with zero unmapped explicit IDs. Seven
manifests lack those identity fields: this is not no prior use. No result,
prediction or outcome ledgers read. Complete prior-use reconciliation remains
open; no new test split or independent-cohort certification issued.

## Next after raw completion

Run full-data checker and field coverage inventory, inspect pre-change value
vocabulary, define auditable positive/negative/ambiguous evidence handling and
check span across baseline samples. Retain all 1,414 candidate assessments and
unknowns. Do not widen lookbacks or infer noninvasive status merely because a
field is missing. No patient fitting or retuning, source outcome inspection,
production changes or accepted UI changes in this batch.
