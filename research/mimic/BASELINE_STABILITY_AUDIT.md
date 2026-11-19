# Baseline stability audit

This audit is isolated from the shared v1.5 working tree.

Branch: research/baseline-stability-audit

## Question

Why do many otherwise acceptable pre-transition phenotypes fail the no-intervention 60-minute stationarity gate?

## Minute ventilation

Current local primary-60 PS FiO2 composite artifact:

- rows: 22
- stationarity pass: 8
- stationarity fail: 14
- recorded minute ventilation available: 21/22

Median recorded minute ventilation:

- pass: 8.9 L/min
- fail: 8.4 L/min

Conclusion:

Low minute ventilation is not a general separator of stationarity failure. The extreme 3.2 L/min event fails, but pass/fail values otherwise overlap substantially. No minute-ventilation eligibility threshold is justified from this audit.

## Descriptive gas-state pattern

Pass versus fail medians:

- PaCO2: 37.0 versus 50.5 mmHg
- PaO2: 75 versus 142 mmHg
- pH: 7.46 versus 7.325
- FiO2: 45% versus 50%
- mechanics/effort prefit objective: 0.413 versus 0.210

Exploratory counts:

- PaCO2 >=60 mmHg: 0/4 pass
- pH <7.35: 0/9 pass
- PaO2 >=180 mmHg: 0/4 pass

These are descriptive failure patterns, not eligibility cutoffs.

## Fixed-SID acid-base limitation

The patient arterial-gas initializer accepts measured PaO2, PaCO2, and pH, but measured pH is retained only as a diagnostic target.

The reduced core:

1. derives arterial HCO3 from PaCO2 and the fixed blood SID boundary;
2. derives the internally consistent model pH from that fixed-SID state;
3. does not alter SID or another acid-base state variable to reproduce measured patient pH.

Direct equivalence test:

Inputs held fixed:

- PaO2 80 mmHg
- PaCO2 60 mmHg

Measured pH request 7.20:

- initialized model pH 7.243894
- initialized PaCO2 60.002 mmHg
- arterial HCO3 state 0.0309 mol/L

Measured pH request 7.40:

- initialized model pH 7.243894
- initialized PaCO2 60.002 mmHg
- arterial HCO3 state 0.0309 mol/L

Therefore, distinct measured acid-base phenotypes collapse onto the same initialized model state when PaCO2/PaO2 are equal.

This provides a mechanistic explanation for the strong enrichment of stationarity failure among acidotic baseline events.

## Implication

The current reduced core should not claim patient-specific acid-base initialization from measured pH.

A future correction must add a defensible patient-specific acid-base boundary/state that can preserve measured pre-transition acid-base status. It must not silently infer or invent an unmeasured SID.

Until that boundary exists, baseline pH mismatch must remain an explicit applicability limitation and stationarity failure criterion.
