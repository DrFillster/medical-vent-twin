# Pre-change candidate input screen - 2026-11-22

## Results

Starting inventory: 286,120 events / 32,176 subjects, with mapped historical
fitting subjects already excluded. Sequential event exclusions:

| Gate | Excluded events |
| --- | ---: |
| Latest available supported PS mode, with no incompatible Hamilton mode | 265,966 |
| Available unambiguous FiO2 | 1,653 |
| Available unambiguous PEEP and unit | 382 |
| Available unambiguous pressure support and unit | 1,249 |
| Observed tidal volume and unit | 1,281 |
| Minute ventilation and unit | 80 |
| Total respiratory rate and unit | 3,868 |

11,641 events / 5,781 subjects meet these chart availability screens.
6,193 events lack an available complete arterial specimen under the screen.
Remaining: **5,448 events / 3,427 subjects** with chart and baseline gas inputs.

No post-change gas presence, values or endpoint timing used. Both charttime
and storetime must precede each transition. Existing development lookbacks
retained (chart 2h, gas 4h), not claimed as a final eligibility protocol. Gas
label, pH, PCO2 and PO2 must share specimen/time block; null/conflicting gas
components rejected. 'mm Hg' and 'mmHg' accepted as equivalent strings;
missing/other gas pressure units rejected. Chart values chosen from the latest
available block, not an older convenient value; same-block conflicts rejected.

## Correction recorded

Initial v1 screen erroneously required exact 'mmHg' string; MIMIC records in
these pre-change windows use 'mm Hg'. That implementation error produced zero
gas candidates. Inspected component-pass counts and actual pre-change unit
strings, corrected normalization, and wrote separate v2 artifacts. The v1
artifacts remain intact for audit. The corrected script/test uses normalized
unit identity, not relaxed patient thresholds or selected outcomes.

## Remaining dependencies

This is input availability, NOT full eligibility or 3,427 qualified twins.
The current chart extraction lacks airway-device fields; a CPAP/PSV label
alone does not prove an invasive airway. No invasive eligibility asserted.
Latest settings/mechanics and gas may be from different clinical states;
source-block/unchanged-exposure consistency remains untested. Exact-PS labels
reuse prior development definitions and exclude unverified variants; Hamilton
only labels are not silently mapped. Unit completeness for chart fields and
contradictions in not-yet-stored rows need further source review. Missing or
later-recorded values are unavailable, not normal. Reference-range plausibility
and mechanical consistency remain to assess, without post-change data access.

Historical-use audit remains incomplete outside mapped root indices. No final
patient split, phenotype assignment, simulator fitting or outcome scoring done.
No pilot-ready or validation claim. All failures retained. Production unchanged.

## Verification and next step

Exact specimen SQL synthetic tests accept equivalent pressure units and reject
missing units, venous specimens, and late-stored components. Full-data contract
checks count conservation, all chart gates, arterial specimen gate, pre-change
windows and source hashes. Hashes recorded at completion, not prospective lock.
Patient data stay in existing restricted derived folders; only aggregate
results/code/tests go to GitHub. No redundant patient exports created.

Next retrieve airway-device source records and align measurements/settings to
compatible pre-change exposure blocks. Retain the 5,448 event ledger for all
subsequent exclusions, extend prior-use reconciliation, then construct fixed
subject-level partition before outcome access. No restart of old-case tuning.
