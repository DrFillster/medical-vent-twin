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
