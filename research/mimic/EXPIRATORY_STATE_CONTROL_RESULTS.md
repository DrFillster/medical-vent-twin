# Pressure readout resolved in research; expiratory-control tests executed

## Readout root cause

At a run boundary, metrics' last record may have no inspiration segment.
The bedside summary chooses this open record and reports Ppeak zero. The
previous valid delivered record contains the correct pressure trace peak.
New research_completed_breath_readout.js explicitly selects the last valid
completed delivered breath, retains its index and preserves raw open peak
for comparison. No completed breath returns null, not manufactured zero.
Production summary unmodified; this is a research-only wrapper, not a deployed
UI correction. Settings-change staleness must be handled before clinical
transition use; the current fixture has no setting changes.

## Executed nine passive mechanics tests

Pressure control with PEEP 5, pressure above PEEP 15, inspiration one second.
Rates 10/20/30; central resistance multipliers 1/10/30. Each run 36 seconds,
then explicit 0.5-second end-expiratory occlusion. Completed-breath pressure
peak is 20 in all nine, independent of whether current raw peak is zero.
All tests have positive delivered volume and a completed zero-flow hold.

| Resistance multiplier | Rate | Hold total PEEP |
|---|---:|---:|
| 1 | 10 | 5.008899836864025 |
| 1 | 20 | 5.01977649382653 |
| 1 | 30 | 5.065652439418542 |
| 10 | 10 | 5.30006193678013 |
| 10 | 20 | 7.154820269433577 |
| 10 | 30 | 9.847617924458167 |
| 30 | 10 | 6.349019577530124 |
| 30 | 20 | 8.860460117068866 |
| 30 | 30 | 11.546698587972209 |

Fixture monotonic checks PASS for total PEEP versus rate at each resistance
and versus resistance at each rate. In this fixture elevated hold pressure
exists even when open airway boundary remains at set PEEP. Use explicit
occlusion rather than boundary pressure to evaluate trapped pressure.

These are solver/mechanism checks, not validated COPD severity levels or
patient parameter recommendations. Central resistance alone does not establish
a disease-specific expiratory flow-limitation model. No gas/circulatory coupling,
no patient-data reads, no diagnoses assigned, production unchanged.

Next: recruitment/history behavior and explicit research live-state adapter,
then timestamped MIMIC evidence selection. Existing template still present.
