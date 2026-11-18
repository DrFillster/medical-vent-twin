# MIMIC ventilator-response validation protocol

## Locked before outcome evaluation

This document defines the first evaluation pass before post-transition outcome values are opened.

## Cohort

Primary prediction cohort:
- adult MIMIC-IV ICU stays;
- official MIMIC `InvasiveVent` episode;
- strict isolated ventilator transition;
- medication/procedure confounder screens passed;
- directly supported HumMod mode;
- well-represented frozen pre-transition phenotype;
- mode/intervention compatibility gate passed.

Current N: 136 transitions.

## Prediction trajectory

The model is initialized from pre-transition information only and the phenotype is frozen before the index intervention.

In addition to the 60-minute freeze, an extended trajectory will be generated every 5 minutes through 180 minutes before outcome values are opened.

The extended trajectory permits comparison at an observed post-transition measurement time without rerunning or retuning the model after the outcome is known.

## Primary gas evaluation

For each event, use the first complete arterial blood gas with pH, PaCO2, and PaO2 obtained from 5 through 180 minutes after the index transition.

The frozen model trajectory is linearly interpolated in time between adjacent 5-minute prediction points to the ABG timestamp.

Primary gas endpoint:
- PaCO2 prediction error.

Secondary gas endpoints:
- pH prediction error;
- PaO2 prediction error;
- direction of change from the pre-transition value.

Report:
- mean absolute error;
- median absolute error;
- signed bias;
- direction-of-change accuracy;
- error distribution by intervention type and ventilator mode.

## Vital-sign evaluation

Evaluate HR, invasive MAP, and SpO2 at nominal 15-, 30-, and 60-minute horizons.

For each horizon, select the nearest documented value within +/-10 minutes. If no value is present in that window, that endpoint is missing for that event/horizon.

Report absolute error, signed bias, and direction-of-change accuracy.

## Baselines

Compare HumMod against:
1. persistence: predicted post value equals the pre-transition value;
2. population-average response estimated without using the evaluated event;
3. a simple empirical model developed with explicit train/test separation.

The persistence comparison can be performed immediately. Population and empirical baselines require a separately specified fitting split.

## Representability analyses

Primary analysis uses the well-represented prediction cohort.

Intermediate and clear-baseline-mismatch phenotypes remain available for sensitivity analyses but are not added to the primary cohort after post-transition errors are inspected.

## No leakage / no retuning

After outcome evaluation begins:
- do not change phenotype-fit bounds using post-transition performance;
- do not change Hennigs effort bounds/profile definitions using prediction performance;
- do not change outcome windows based on observed errors;
- do not remove individual events because their prediction is poor;
- any later model change creates a new model version and a new prospective/frozen prediction set.


## Locked baseline-development split

Before post-transition outcome values are opened, the population-average and empirical baselines use a deterministic event-level split derived only from the stable event ID:

1. compute SHA-256 of `event_id`;
2. interpret the first 8 hexadecimal characters as an unsigned integer;
3. take modulo 10;
4. values 0-6: training set;
5. values 7-9: held-out test set.

The split is independent of patient physiology, intervention, prediction error, and outcome values.

Primary HumMod versus persistence analysis uses the full frozen 136-event cohort.

Population-average and empirical-model comparisons are fit on the training subset and scored only on the held-out test subset. No event may move between sets after outcomes are opened.


# Freeze 2 amendment — stationarity-gated validation

Freeze 1 has been evaluated and is retained as a failed validation artifact. Freeze 2 is a new model-validation cycle.

## Outcome separation

Freeze 2 may use only events whose post-transition outcomes were not opened by the Freeze 1 evaluation workflow.

Local outcome-unseen pool at amendment lock:

- 268 events
- PS: 225
- PC_AC-mapped: 39
- VC_AC: 4
- P-CMV within the PC_AC-mapped group: 35

## Mode eligibility change

P-CMV is removed from direct support for Freeze 2.

Reason: the current `PcAcController` is time-triggered only, while pressure assist-control / PC-CMV permits patient-triggered mandatory breaths. A P-CMV event can return only after a patient-triggered pressure-control controller is implemented and tested.

Other pressure-control labels are not automatically assumed equivalent; they must pass the same controller-capability review.

## Mandatory pre-transition stationarity gate

After phenotype fitting, each candidate must be simulated under unchanged pre-transition ventilation for 60 minutes.

No post-transition outcomes may be loaded.

A phenotype is stationarity-eligible only if, at 60 minutes:

- absolute PaCO2 drift from the fitted pre-transition baseline is <= 8 mmHg; and
- absolute PaO2 drift is <= 20 mmHg.

These are the same gas-error scales that were already used in the pre-transition phenotype fitter before Freeze 1 outcome evaluation.

The gate is fail-closed.

The stationarity trajectory is a phenotype-identification/eligibility test only. It is not an intervention prediction.

## Freeze 2 prediction rule

Only after:

1. outcome-unseen status is verified;
2. mode/controller compatibility is verified;
3. phenotype fitting is complete;
4. 60-minute no-intervention stationarity passes;

may the index ventilator transition be applied.

Freeze 2 predictions must then be written to a new file, hashed, and committed to a new freeze record before any Freeze 2 post-transition outcome bridge is created.

## Interpretation

Freeze 2 is the first cohort eligible for a confirmatory response-prediction claim after the stationarity defect discovered in Freeze 1.

Freeze 1 remains part of the audit trail and must not be overwritten or reclassified as successful.


## Freeze 2 final controller-compatibility gate

The stationarity audit of 221 outcome-unseen, fit-complete, non-P-CMV events produced 85 stationarity-pass events.

A stricter controller-capability gate is applied before prediction freeze.

### Included

Only pressure-support events with MIMIC pre-transition mode:

- `SPONT`
- `CPAP/PSV`
- `PSV/SBT`

and index intervention:

- FiO2
- PEEP

These map to the current patient-triggered PS controller without requiring a time-triggered assist/control approximation.

### Excluded

- all current PC_AC mappings, because the implemented controller is time-triggered and does not model patient-triggered assist/control breaths;
- `CMV/ASSIST` for the same reason in the current VC controller;
- `CPAP/PPS`, because proportional pressure support is not equivalent to fixed pressure support;
- set-RR transitions in PS, because MIMIC set-RR semantics in these spontaneous modes are not assumed to equal the model backup-rate control;
- set-VT transitions outside directly supported VC control.

### Freeze 2 pre-outcome cohort

Stationarity-pass and controller-compatible events:

- total: 81
- CPAP/PSV: 35
- SPONT: 45
- PSV/SBT: 1
- FiO2 transitions: 44
- PEEP transitions: 37

All 81 events are outcome-unseen by the Freeze 1 evaluation workflow at this gate.


# Freeze 3 pre-outcome development amendment

Freeze 2 evaluation showed that no-intervention stationarity is necessary but not sufficient.

Freeze 3 phenotype eligibility must satisfy both baseline fidelity and stationarity.

## Baseline-fidelity gate

The gate uses the same gas residual scales that existed in the phenotype fitter before Freeze 1 outcome evaluation:

- absolute PaCO2 baseline residual <= 8 mmHg
- absolute PaO2 baseline residual <= 20 mmHg

The event must then pass the existing 60-minute unchanged-ventilation stationarity gate:

- absolute PaCO2 drift <= 8 mmHg
- absolute PaO2 drift <= 20 mmHg

Both gates are fail-closed.

## Controller eligibility

Until additional controller semantics are implemented and tested, Freeze 3 development is restricted to:

- SPONT
- CPAP/PSV
- PSV/SBT

mapped to the patient-triggered PS controller.

Index interventions:

- FiO2
- PEEP

## Outcome separation

Freeze 3 development may use only pre-transition data for the 187 events whose outcomes remain unopened after Freeze 1 and Freeze 2.

Any new phenotype-fitting method may be developed using the known aggregate failure modes from prior freezes, but individual Freeze 3 post-transition outcomes remain unavailable until a new prediction artifact is frozen and hashed.


## Freeze 3A — FiO2-only state-identification protocol

Freeze 3A is restricted to FiO2 transitions in directly supported pressure-support modes.

Pre-fit candidate requirements:

- post-transition outcome remains unopened after Freeze 1 and Freeze 2;
- MIMIC pre-transition mode is SPONT, CPAP/PSV, or PSV/SBT;
- index intervention is FiO2;
- original PS phenotype fit completed;
- original pre-transition respiratory-effort score <= 2.

At protocol lock, 45 events meet these requirements.

### Stationarity-aware recruitment-state fit

The following quantities remain fixed from the pre-transition PS phenotype fit:

- Hennigs effort profile;
- Hennigs drive;
- respiratory stiffness scale;
- central airway resistance;
- fixed nonventilated perfusion fraction.

The refit estimates only existing model state/parameters:

1. current recruited fraction:
   - candidate grid 0.20, 0.40, 0.60, 0.80, 1.00;
2. recruitment closing threshold:
   - effective P_close candidate grid 0 to 2 cmH2O in 0.25-cmH2O increments;
   - P_open is constrained to P_close + 10 cmH2O;
   - k_open and k_close remain unchanged from the reference mechanics;
3. dead-space fraction of delivered tidal volume:
   - candidate grid 0.10, 0.25, 0.40, 0.55, 0.70, 0.82.

All fitting uses unchanged pre-transition ventilation and pre-transition measurements only.

Candidate-state searches use a 15-minute unchanged-ventilation horizon. The selected state is then independently confirmed for 60 minutes under unchanged ventilation.

### Final eligibility gate

A fitted event is Freeze 3A prediction-eligible only when:

- absolute baseline PaCO2 residual <= 8 mmHg;
- absolute baseline PaO2 residual <= 20 mmHg;
- absolute 60-minute PaCO2 drift <= 8 mmHg;
- absolute 60-minute PaO2 drift <= 20 mmHg.

The original respiratory-effort score <= 2 requirement remains in force.

No Freeze 3A post-transition outcome is opened during fitting or eligibility selection.

### Scope

Freeze 3A tests FiO2 response only.

PEEP outcomes remain unopened for a later recruitment-dynamics validation. PEEP response requires additional identification of recruitment thresholds from prior PEEP history.


## Freeze 3A pre-freeze implementation correction

Before any Freeze 3A prediction artifact was created, an implementation audit found that `fit_ps_stationary.js` defaulted to `freeze3_dev_index.jsonl` instead of the locked `freeze3a_fio2_prefit_index.jsonl`.

Consequences:

- the initial local refit dry run did not represent the locked Freeze 3A cohort;
- no Freeze 3A post-transition outcomes were opened;
- no prediction file was frozen from the invalid dry run;
- all wrong-index local refit artifacts were quarantined under:
  - `/Users/philipbernard/mimic-data/derived/invalid_freeze3a_wrong_index/`

The corrected fitter now defaults to the locked Freeze 3A index and fails closed unless:

- event IDs are unique;
- pre-transition mode is SPONT, CPAP/PSV, or PSV/SBT;
- effort score is finite and <=2;
- the corresponding Freeze 3 development record is a FiO2 transition.

The locked Freeze 3A index remains:

- 45 rows;
- 45 unique events;
- all outcome-unseen at protocol lock;
- CPAP/PSV: 22;
- SPONT: 23.

The invalid dry-run fit results are not eligible for analysis or prediction freeze.


## Freeze 3A fitter-parameterization correction

A second pre-freeze audit found that the development script `fit_ps_stationary.js` did not match the locked Freeze 3A parameter roles:

- it refit fixed nonventilated perfusion, which the protocol required to remain fixed;
- it did not fit the recruitment closing threshold P_close, which the protocol required.

Those incomplete-protocol workers were stopped before any Freeze 3A prediction freeze or outcome opening. No results from that run are eligible for analysis.

The final locked fitter is:

`research/mimic/fit_freeze3a_locked.js`

It implements the locked Freeze 3A state-identification model as follows:

Fixed from the original pre-transition PS fit:

- Hennigs effort profile;
- Hennigs drive;
- respiratory stiffness scale;
- central airway resistance;
- fixed nonventilated perfusion fraction.

Refit from pre-transition measurements only:

1. current recruitable-compartment state:
   - 0.20, 0.40, 0.60, 0.80, 1.00;
2. recruitment closing threshold P_close:
   - 0 to 2 cmH2O in 0.25-cmH2O increments;
   - P_open = P_close + 10 cmH2O;
   - recruitment kinetic constants unchanged;
3. dead-space fraction of delivered VT:
   - 0.10, 0.25, 0.40, 0.55, 0.70, 0.82.

Deterministic staged search:

- current recruitment search at the lower P_close bound;
- P_close search with the selected current recruitment state;
- dead-space search with selected recruitment state/threshold;
- each search uses 15 minutes of unchanged pre-transition ventilation;
- the selected state is confirmed for 60 minutes under unchanged ventilation.

Eligibility remains exactly:

- absolute baseline PaCO2 residual <=8 mmHg;
- absolute baseline PaO2 residual <=20 mmHg;
- absolute 60-minute PaCO2 drift <=8 mmHg;
- absolute 60-minute PaO2 drift <=20 mmHg.

The final fitter fails closed against the 45-event locked Freeze 3A index before running.
