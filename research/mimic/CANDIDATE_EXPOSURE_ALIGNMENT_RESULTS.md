# Candidate airway/exposure documentary audit - 2026-11-22

## Completed

All 5,448 input-complete candidate events retained in an assessment ledger.
Found existing airway_type_events.parquet and verified extract_airway_type.py:
it selects all raw chart rows for item 223836, not a prior fitted cohort. No
large raw-file reread or redundant extraction needed for this narrow field.
Local d_items dictionary confirms 223836 Airway Type; broader ETT/tracheostomy
fields exist but are absent from this existing single-item extract.

## Results

- 1,414 events satisfy conservative recorded-exposure compatibility.
- 62 events have a recent available, unambiguous Oral/Nasotracheal airway label.
- 20 events in 17 subjects meet both documentary screens.

These are NOT 17 qualified twins or a finalized invasive test cohort. Airway
screen covers only a narrow route field, not comprehensive intubation evidence;
missing label cannot establish noninvasive ventilation. Other 5,386 events do
not meet this narrow positive-label requirement and are not all ruled out.
Do not relax eligibility or widen lookbacks merely to increase sample count.
Broader tube-device records are the next data-source task.

## Exposure rule

For each of four measurements (latest available complete arterial specimen,
observed tidal volume, minute volume, total RR), require each of four settings
(FiO2, PEEP, PSV level, primary mode) to have a matching record STRICTLY before
sample charttime, plus no documented differing/invalid setting at or after
sample time before cutoff. Exact charttime-only setting evidence does not
establish order. All source records must be charted AND stored before change.
Lookback for documentary settings is six hours, reusing prior context audit;
this is a screen, not a newly validated clinical stability window. Latest gas
is selected by time, not whichever specimen gives the best alignment.

No-recorded-change does not prove physiological stability or uninterrupted
exposure. Data gaps, unrecorded interventions, settings absent from this four-
field screen, and later-stored rows remain limitations. Airway evidence here
is before the change, not yet verified to span every measurement time.
Full source review, invasive adjudication and complete prior-use reconciliation
remain prerequisites to subject partition. No fitting or outcomes accessed.

## Checks

Synthetic exact-SQL tests pass earlier support, equal-time ambiguity, later
setting changes, invalid blocks and mismatch cases. Full-data checks verify
all-input ledger, 16 checks per compatible event, strict earlier evidence,
positive route rule and source hashes. Source hashes recorded after run, not
claimed prospective protocol lock. Local dictionary/extract code reviewed;
no inferred item IDs or nearest-name replacements. Production unchanged.
Patient records remain in existing restricted derived storage; code/tests and
aggregate findings only on GitHub.

## Next

Extract relevant ETT/tracheostomy device fields identified in local dictionary,
restricted to candidate subjects and pre-change cutoffs, and reconcile positive
and contradictory evidence without interpreting absence as noninvasive. Keep
the 1,414 exposure-compatible events available for this broader airway check.
Then finalize prior-use audit and deterministic subject split; no restart of
parameter tuning and no post-change blood-gas selection.
