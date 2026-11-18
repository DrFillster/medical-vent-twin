# Freeze 1 evaluation

## Status

Freeze 1 is a completed but failed validation artifact.

The prediction files remain immutable and are retained for auditability. The failure is not repaired by changing the frozen predictions or removing poor events.

## Frozen cohort

- 136 prediction-eligible events
- all 136 had complete arterial blood gas outcomes in the locked 5-180 minute window
- 124/123/123 had HR/MAP/SpO2 outcomes at the locked 60-minute horizon

## Primary gas results

HumMod versus persistence across all 136 events:

### PaCO2

- HumMod MAE: 54.54 mmHg
- HumMod median absolute error: 13.79 mmHg
- HumMod bias: +47.33 mmHg
- Persistence MAE: 3.35 mmHg
- Persistence median absolute error: 2.00 mmHg
- Persistence bias: -0.77 mmHg

### pH

- HumMod MAE: 0.310
- HumMod median absolute error: 0.210
- HumMod bias: -0.166
- Persistence MAE: 0.0278
- Persistence median absolute error: 0.020
- Persistence bias: +0.005

### PaO2

- HumMod MAE: 41.86 mmHg
- HumMod median absolute error: 33.20 mmHg
- HumMod bias: -37.84 mmHg
- Persistence MAE: 23.41 mmHg
- Persistence median absolute error: 14.0 mmHg
- Persistence bias: -19.75 mmHg

## 60-minute vital-sign results

### Heart rate

- N: 124
- HumMod MAE: 21.29/min
- Persistence MAE: 4.47/min

### Invasive MAP

- N: 123
- HumMod MAE: 19.99 mmHg
- Persistence MAE: 7.57 mmHg

### SpO2

- N: 123
- HumMod MAE: 18.00 percentage points
- Persistence MAE: 1.93 percentage points

## Baseline replay audit

The pre-transition baseline itself was reproduced much better than the forward trajectory:

- baseline PaCO2 MAE: 2.01 mmHg
- baseline PaO2 MAE: 12.69 mmHg

This led to a no-intervention stationarity audit of all 136 frozen phenotypes.

## No-intervention stationarity audit

Each frozen phenotype was replayed for 60 minutes under unchanged pre-transition ventilator settings.

Using the gas-fit scales already present before outcome evaluation:

- |PaCO2 drift| <= 8 mmHg
- |PaO2 drift| <= 20 mmHg

only 38/136 phenotypes remained within both scales at 60 minutes.

By mapped mode:

- PC_AC: 3/31
- PS: 34/101
- VC_AC: 1/4

Median 60-minute PaCO2 drift:

- PC_AC: 182.0 mmHg
- PS: 10.1 mmHg
- VC_AC: 16.9 mmHg

The model therefore did not start from a sufficiently stable dynamic state for most Freeze 1 events.

## Root cause 1: phenotype confirmation was too short

The controlled phenotype fitter initialized arterial gases directly from the measured pre-transition ABG, then confirmed the fit for only 16 seconds.

That can establish instantaneous proximity to the measured state but does not establish that the measured state is a stable solution of the coupled model under unchanged ventilation.

Freeze 2 must require a no-intervention stationarity check before an event can become prediction-eligible.

## Root cause 2: P-CMV mapping exceeded controller capability

The current `PcAcController` is purely time-triggered. It schedules breaths from the set respiratory rate and does not consume patient effort or trigger additional breaths.

MIMIC `P-CMV` was mapped to that controller.

Pressure assist-control / PC-CMV can include patient-triggered mandatory pressure-controlled breaths. Therefore, direct `P-CMV -> PC_AC` mapping is not sufficiently faithful for validation with the current controller.

In the supported-mode phenotype table:

- P-CMV accounted for 66/70 PC_AC-mapped events.
- These P-CMV events had markedly different observed ventilation from the small PCV+Assist/PRES-AC group.

Until patient-triggered pressure assist-control is implemented and tested, P-CMV must not be included as a directly supported mode.

## Outcome-unseen pool

Post-transition outcomes were opened only for the 136 Freeze 1 events.

The local fit-event index contains 404 prefit-eligible events.

Outcome-unseen events remaining:

- total: 268
- PS: 225
- PC_AC: 39
- VC_AC: 4

These event outcomes remain unopened by the evaluation workflow and can support a new frozen validation only after a revised pre-transition model is locked.

## Freeze 2 requirements

1. Freeze 1 predictions and results remain unchanged.
2. Use only outcome-unseen events.
3. Remove P-CMV from the direct supported-mode map unless a tested patient-triggered PC-CMV controller is added.
4. Require a 60-minute no-intervention stationarity audit before prediction eligibility.
5. Stationarity must be evaluated using pre-transition state only.
6. Do not use Freeze 1 post-transition errors to select or tune individual Freeze 2 phenotypes.
7. Any model/runtime changes receive a new version and new prediction freeze hash.
