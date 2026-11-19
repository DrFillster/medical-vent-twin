# Blinded primary validation set

The primary validation dataset is split into two local files:

- `blinded_primary_prediction_inputs.parquet`
- `blinded_primary_prediction_truth.parquet`

Both are generated locally by:

`research/mimic/build_blinded_prediction_set.py`

Patient-level files are not committed to GitHub.

## Primary scope

Primary interventions:

- FiO2
- PEEP

Primary supported modes:

- PS
- PC_AC
- VC_AC

RR and VT interventions remain exploratory because the directly supported cohort is too small for balanced primary validation.

## Blinding rule

The prediction-input file contains only:

- pre-transition phenotype state;
- pre-transition ventilator settings;
- intervention type;
- intervention value before the change;
- intervention value after the change.

The input file must contain no post-transition outcome field.

The build script fails if any `post_*` field is present in the blinded input schema.

The truth file contains:

- event_id
- intervention type
- post-ABG timing
- post pH
- post PaCO2
- post PaO2
- post HR
- post MAP
- post SpO2

The fitter and forward simulator must not read the truth file.

## Current primary cohort

Total:

- 330 events

By intervention:

- FiO2: 196
- PEEP: 134

By mode:

- PS: 272
- PC_AC: 51
- VC_AC: 7

All 330 events have complete held-out post pH, PaCO2, and PaO2.

## Prediction contract

A model prediction file must contain:

- event_id
- predicted_post_ph
- predicted_post_pco2
- predicted_post_po2
- predicted_post_hr
- predicted_post_map
- predicted_post_spo2

Optional diagnostic fields may include:

- phenotype fit grade
- parameter-boundary flags
- simulation failure flag
- simulation failure reason
- model version / commit
- runtime source marker

The scorer joins predictions to truth only after prediction generation is complete.

## No-future-leakage rule

No post-transition value may be used for:

- phenotype selection;
- parameter fitting;
- model initialization;
- model exclusion;
- model hyperparameter selection;
- simulation rescue.

Simulation failures must be recorded as failures, not repaired using held-out outcomes.


## Controlled-mode controller state

The blinded input file includes pre-transition inspiratory timing/flow needed to recreate the exact controlled ventilator state:

- PC_AC: `pre_inspiratory_time_sec`
- VC_AC: `pre_inspiratory_flow_lps`
- optional: `pre_inspiratory_ratio`

These are pre-transition controller inputs and do not contain outcome information.

## Baseline-stability requirement

A prediction is not considered valid unless the fitted phenotype can first maintain the observed pre-transition state without an intervention.

Current development QC checks baseline drift in:

- PaO2
- PaCO2
- pH
- ventilator mechanics

Gas-state fitting may use pre-transition:

- effective dead-space fraction
- ventilated-perfusion fraction
- metabolic CO2 production

These parameters must be frozen before the index ventilator change.

A failed baseline-stability test is a model/identifiability failure and must not be repaired using post-transition outcomes.
