# Isolated mechanics controls: first executed experiment

Synthetic passive pressure-control, identical settings and recruitment; gas
tracking disabled. Standalone Simulation, not the coupled live patient twin.
All runs completed with finite positive inspired breath volume. Baseline replay
identical. Raw simulator inspiredVolumeL outputs:

| Configuration | inspiredVolumeL |
|---|---:|
| Baseline | 0.5401132863261237 |
| Resistance doubled alone | 0.5348930423659496 |
| Elastic scale doubled alone | 0.3058930508377857 |
| Capacity halved alone | 0.2668314122652032 |
| Existing coupled stiffness/capacity change | 0.14972972331808163 |

Independent research parameter builder added; defaults exactly reproduce old
baseline parameters. Elastic=2/capacity=0.5/resistance=1 exactly reproduces old
coupled parameter object. Invalid values rejected. Isolated changed-path tests
ensure only intended fields change; input template remains unmodified.

IMPORTANT: summary peak-pressure field returned zero in all PC runs. Pressure
readout is unresolved and not accepted as a validated result. Next inspect
breath versus latest-expiratory summary provenance; do not calibrate patient
pressure targets from that field until resolved.

This demonstrates separate configurable numerical effects, not validated
COPD, restrictive disease, preserved lung, or ARDS variants. No MIMIC reads,
patient fits or production edits. Common aspiration compartments remain.
Next: resolve pressure readout, test expiration/resistance and recruitment,
then connect explicit parameters to research live sessions with provenance.
