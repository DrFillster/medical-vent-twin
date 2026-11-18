# Freeze 2 evaluation

## Status

Freeze 2 is a completed negative validation.

It corrected the major Freeze 1 stationarity and controller-mapping defects, but the stationarity-pass cohort still did not reproduce the measured pre-transition oxygenation accurately enough for a valid absolute-state prediction.

The frozen predictions remain immutable.

## Frozen cohort

- 81 events
- all pressure-support mode
- pre-transition MIMIC modes:
  - SPONT: 45
  - CPAP/PSV: 35
  - PSV/SBT: 1
- FiO2 transitions: 44
- PEEP transitions: 37
- all events passed the locked 60-minute no-intervention gas-stationarity gate
- all events were outcome-unseen at prediction freeze
- prediction file SHA-256:
  - `8a96fea22068d4e20fb06b80b85099f91be99cc8bf8df5c19c4e0c9c7fb0d48a`

## Primary gas results

### PaCO2

- HumMod MAE: 12.01 mmHg
- median absolute error: 3.95 mmHg
- bias: +4.36 mmHg
- persistence MAE: 2.47 mmHg
- persistence median absolute error: 2.0 mmHg

By intervention:

- FiO2:
  - HumMod MAE: 4.13 mmHg
  - persistence MAE: 2.23 mmHg
- PEEP:
  - HumMod MAE: 21.38 mmHg
  - persistence MAE: 2.76 mmHg

### pH

- HumMod MAE: 0.120
- persistence MAE: 0.0194

### PaO2

- HumMod MAE: 63.31 mmHg
- bias: -63.31 mmHg
- persistence MAE: 28.30 mmHg

By intervention:

- FiO2 HumMod MAE: 64.25 mmHg
- PEEP HumMod MAE: 62.18 mmHg

## 60-minute vital-sign results

### Heart rate

- N: 77
- HumMod MAE: 17.70/min
- persistence MAE: 5.04/min

### Invasive MAP

- N: 77
- HumMod MAE: 18.85 mmHg
- persistence MAE: 7.91 mmHg

### SpO2

- N: 76
- HumMod MAE: 14.41 percentage points
- persistence MAE: 1.49 percentage points

## Held-out test subset

Deterministic split:

- training: 61
- held-out test: 20

Held-out PaCO2 MAE:

- HumMod: 5.33 mmHg
- persistence: 1.90
- population-average: 2.27
- empirical: 2.85

Held-out PaO2 MAE:

- HumMod: 53.35 mmHg
- persistence: 21.55
- population-average: 22.12
- empirical: 31.74

## Baseline fidelity diagnosis

The stationarity gate succeeded in preventing the major dynamic drift seen in Freeze 1, but Freeze 2 did not require the frozen baseline to match the measured state closely enough.

Baseline error before the index intervention:

### FiO2-transition events

- PaCO2 MAE: 2.20 mmHg
- PaO2 MAE: 48.36 mmHg
- SpO2 MAE: 5.05 percentage points
- HR MAE: 15.46/min
- MAP MAE: 16.01 mmHg

### PEEP-transition events

- PaCO2 MAE: 1.97 mmHg
- PaO2 MAE: 50.75 mmHg
- SpO2 MAE: 6.11 percentage points
- HR MAE: 14.77/min
- MAP MAE: 14.84 mmHg

Thus the model was dynamically stable but centered on the wrong oxygenation/hemodynamic state.

## Why this occurred

All 81 Freeze 2 events had been excluded from the original Freeze 1 well-represented phenotype set:

- intermediate phenotype: 51
- clear baseline mismatch: 30
- original gas score <=2: 10/81

The stationarity criterion was necessary but not sufficient.

A valid prediction phenotype must satisfy both:

1. baseline fidelity; and
2. dynamic stationarity under unchanged pre-transition ventilation.

## Freeze 3 requirement

Freeze 3 can use only post-transition outcomes that remain unopened after Freeze 1 and Freeze 2.

Outcome-unseen events remaining after both evaluations:

- 187 total
- SPONT: 72
- CPAP/PSV: 70
- PSV/SBT: 1
- CPAP/PPS: 1
- P-CMV: 35
- PCV+Assist: 3
- PRES/AC: 1
- CMV/ASSIST: 4

Current directly compatible PS pool before refitting:

- 143 events:
  - SPONT: 72
  - CPAP/PSV: 70
  - PSV/SBT: 1

No Freeze 3 post-transition outcome may be opened until a new phenotype-fit method, baseline-fidelity gate, stationarity gate, and prediction file are frozen.
