# MIMIC ventilator-transition pilot review

## Purpose
Manually verify a balanced first sample of 100 ventilator transitions before the automated validation cohort is frozen.

## Current pilot screen
- Adult ICU stay.
- Core intervention: FiO2, PEEP, set respiratory rate, or set tidal volume.
- Values pass pilot plausibility checks.
- Material change threshold: FiO2 >=10 percentage points; PEEP >=2 cmH2O; set RR >=2 breaths/min; set VT >=50 mL.
- No other material ventilator transition within +/-30 minutes.
- Complete arterial pH, PCO2 and PO2: pre-transition within 4 hours; post-transition within 6 hours.
- HR, invasive MAP and SpO2: pre-transition within 1 hour; post-transition within 2 hours.
- All timing is constrained to the same ICU stay.

These are pilot screening parameters, not final clinical thresholds.

## Manual adjudication
Classify each event as: accept, exclude_documentation, exclude_competing_intervention, exclude_inadequate_state, exclude_timing, or uncertain.

## Review
Inspect ventilator mode/settings, ABG timing and values, HR/MAP/SpO2 trajectory, observed VT, total/spontaneous RR, minute ventilation, airway pressures, pressure support/control settings, and nearby procedures. Vasoactive/sedative confounder screening will be added next.

## Freeze rule
Do not tune HumMod physiology from post-transition outcomes during adjudication. Initialize the model only from information available before the transition.
