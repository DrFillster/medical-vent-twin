# Pre-transition phenotype model

## Purpose

Define the patient-specific state that may be used to initialize HumMod before an index ventilator transition.

The phenotype is estimated only from information available at or before the transition time. Post-transition physiology is never used to choose or tune phenotype parameters.

## Layers

### 1. Measured state

Directly observed or derived from pre-transition MIMIC data:

- ventilator mode
- FiO2
- PEEP
- set respiratory rate
- set tidal volume
- inspiratory pressure / pressure support when applicable
- HR
- invasive MAP
- SpO2
- arterial pH
- arterial PCO2
- arterial PO2
- bicarbonate
- base excess
- lactate
- observed tidal volume
- minute ventilation
- spontaneous respiratory rate
- total respiratory rate
- peak airway pressure
- plateau pressure
- mean airway pressure
- total PEEP
- documented compliance / resistance when available

Derived pre-transition descriptors:

- P/F ratio
- compliance from observed VT / (plateau - PEEP), only when all inputs are present and valid
- a ventilation-CO2 index used as a fitting descriptor, not as a clinical endpoint

## 2. Latent mechanistic phenotype

These parameters are not assigned from a diagnosis label and are not silently imputed from post-transition data.

Candidate fitted parameters:

- respiratory-system compliance
- airway resistance
- effective shunt fraction
- effective dead-space fraction
- recruitability
- Hennigs effort profile
- hemodynamic sensitivity to airway pressure
- autonomic response gain

All latent fields are NULL in the initial phenotype table until a fitter constrains them.

## 3. Identifiability grade

### Grade A

Complete pre-transition ABG, HR, MAP, SpO2, FiO2, and PEEP plus:

- PS: at least three effort observables from spontaneous RR, total RR, observed VT, and minute ventilation; or
- VC_AC / PC_AC: at least one respiratory-mechanics observable.

### Grade B

Complete pre-transition ABG, HR, MAP, SpO2, FiO2, and PEEP plus:

- PS: at least two effort observables; or
- VC_AC / PC_AC: required controller settings are present but no additional mechanics observable is required.

### Grade C

Does not meet Grade A or B.

Grade C events are not eligible for the primary patient-specific validation until the missing state can be resolved from additional pre-transition data.

## Current supported-mode phenotype table

Source pool:

- invasive ventilation by official MIMIC ventilation concept
- isolated transition
- complete pre/post physiologic screen
- medication-confounder screen
- procedure / recruitment / SBT / ECMO screen
- direct MIMIC-to-HumMod mode mapping

Rows: 411

Identifiability:

- Grade A: 396
- Grade B: 8
- Grade C: 7

By mode:

- PC_AC: 69 A, 1 B
- PS: 319 A, 7 B, 7 C
- VC_AC: 8 A

Availability:

- pre-transition P/F ratio: 411/411
- directly derivable compliance from observed VT and plateau/PEEP: 39/411

The low direct-compliance availability is important. Compliance, resistance, shunt, dead space, recruitability, hemodynamic sensitivity, and autonomic gain must not be treated as known measurements in most patients.

## Fitting rule

For each event:

1. assemble the measured pre-transition state;
2. determine the mode-specific required controller inputs;
3. choose only latent parameters that are identifiable from available pre-transition observations;
4. fit against pre-transition measurements only;
5. retain population priors/defaults for parameters that are not identifiable;
6. record which parameters were fitted versus prior-constrained;
7. freeze the complete phenotype;
8. apply the index ventilator change;
9. run the forward prediction;
10. compare with post-transition MIMIC outcomes.

## Assisted-mode effort fitting

For PS events, effort profile is a latent state selected before the index transition.

Candidate profiles already implemented in the model:

- passive_paralyzed
- sedated_breathing
- awake_cooperative
- agitated_high_drive

Fit targets come only from the pre-transition period:

- spontaneous RR
- total RR
- observed VT
- minute ventilation
- airway pressure context when available

The selected profile is frozen before the intervention.

## No-leakage requirements

Forbidden during phenotype fitting:

- post-transition ABG
- post-transition HR or MAP
- post-transition SpO2
- any post-transition ventilator response
- knowledge of which phenotype produces the best post-transition prediction

Earlier pre-index ventilator changes may be used if they occur before the index event and are explicitly incorporated as historical identification data.

## Phenotype output contract

Each frozen phenotype must record:

- event identifier
- transition time
- measured-state fields
- HumMod controller mode
- identifiability grade
- each fitted latent parameter
- each prior-constrained latent parameter
- effort profile when applicable
- source window for each fitted observation
- fitting objective value / residual summary
- code commit and phenotype-schema version

This permits full reconstruction of the state used for every blinded prediction.


## Phenotype contract update: numerical prefit

The numerical phenotype now records domain-specific fitted and constrained states.

### Arterial gas initialization

Pre-transition PaO2 and PaCO2 initialize the reduced HumMod arterial gas state through the model's own chemistry functions.

- PaO2 -> arterial O2 content using the HumMod hemoglobin/O2 relation.
- PaCO2 -> arterial bicarbonate state using the HumMod gas-to-base relation at fixed model SID.
- measured pH is retained as a diagnostic target;
- no patient-specific SID is invented;
- venous gas state remains a source prior unless an independent patient venous measurement is available.

### Effective oxygenation phenotype

The fitter does not use a direct PaO2 correction or free shunt knob.

Instead, it may fit a model-native fixed nonventilated perfusion burden by changing the perfusion fraction assigned to the nonventilated consolidated compartment while:

- keeping total perfusion fraction equal to 1;
- retaining the reference normal:recruitable perfusion ratio for the remaining flow.

This parameter is reported as:

- `fixed_nonventilated_perfusion_fraction`

Dynamic recruitability remains separate and is identified only from pre-index perturbation history where available.

### Pressure-support effort phenotype

For PS events the effort phenotype contains two components:

1. `hennigs_drive_relative`
   - continuous;
   - fit from pre-transition respiratory behavior;
   - constrained to the Hennigs-supported frequency envelope.

2. `effort_profile`
   - discrete transmission anchor:
     - passive_paralyzed
     - sedated_breathing
     - awake_cooperative
     - agitated_high_drive

The project-created muscle-transmission scalar is not itself treated as a free continuous patient parameter.

### Prefit scores remain domain specific

Controlled modes:

- gas prefit score
- mechanics prefit score

Pressure support:

- effort prefit score
- gas prefit score

A patient can therefore be well represented in one domain and poorly represented in another. These scores must remain separate in analysis and provenance.

Post-transition observations are not used to choose any prefit parameter or representability classification.
