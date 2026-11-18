# MIMIC HumMod validation status

## Current state

MIMIC-IV v3.1 acquisition is complete for the tables required for the first ventilator-transition validation study.

All patient-level data remain local under:

`/Users/philipbernard/mimic-data/`

No credentialed MIMIC rows, row-level extracts, DuckDB files, or Parquet files are committed to GitHub.

## Extracted local datasets

- Adult ICU stays: 94,458
- Distinct adult ICU subjects: 65,366
- Raw ventilator transition candidates: 759,654
- Cleaned material ventilator transitions: 694,154
- ICU stays with cleaned transitions: 41,515
- Arterial blood-gas specimens: 529,311
- Subjects with arterial blood gases: 50,226
- Transitions with both pre- and post-arterial blood gases within the broad 6-hour screen: 263,084

## Core ventilator-transition variables

First-study transition candidates are based on:

- FiO2
- PEEP
- set respiratory rate
- set tidal volume
- pressure support
- pressure control
- ventilator mode

The first manual pilot is intentionally limited to the four most interpretable discrete settings:

- FiO2
- PEEP
- set respiratory rate
- set tidal volume

## Data cleaning

Pilot plausibility filters:

- FiO2:
  - 21-100% accepted directly
  - 0.21-1.0 normalized to 21-100%
  - other values rejected
- PEEP: 0-30 cmH2O
- set respiratory rate: 4-60/min
- set tidal volume: 100-1000 mL
- pressure support / pressure-control / inspiratory pressure: 0-60 cmH2O

Observed FiO2 representation:

- 1,140,263 rows in percent form
- 153 rows in fractional form
- 3,873 rows outside the accepted pilot range

## Material-change thresholds

These are pilot screening thresholds, not final clinical thresholds:

- FiO2: >=10 percentage points
- PEEP: >=2 cmH2O
- set RR: >=2 breaths/min
- set VT: >=50 mL
- PSV/PCV/Pinsp: >=2 cmH2O
- ventilator mode: any documented mode change

## Arterial blood-gas identification

Blood-gas pH, PCO2 and PO2 are not assumed to be arterial.

The pipeline uses MIMIC blood-gas specimen type (item 52033) and retains only specimen type `ART.` for the arterial blood-gas dataset.

Specimen-type counts observed during validation:

- ART.: 534,875 rows
- VEN.: 218,440
- MIX.: 67,683
- CENTRAL VENOUS.: 18,952

## Broad pilot pool

Initial high-quality screen:

- adult ICU stay
- one of the four core interventions
- plausible values
- material setting change
- no other material ventilator change within +/-30 minutes
- complete arterial pH/PCO2/PO2 before and after
- pre ABG within 4 hours
- post ABG within 6 hours
- HR, invasive MAP and SpO2 available before and after
- all timing constrained to the same ICU stay

Result:

- 73,959 transitions
- 18,811 ICU stays

By intervention:

- FiO2: 42,858
- PEEP: 19,100
- set RR: 10,409
- set VT: 1,592

## Stronger isolation screen

A tighter review screen was then applied:

- no other material ventilator transition within +/-60 minutes
- pre ABG <=120 minutes before transition
- post ABG <=180 minutes after transition
- ventilator mode documented within +/-2 hours
- respiratory context documented within +/-2 hours

Respiratory context includes one or more of:

- observed tidal volume
- minute ventilation
- total or spontaneous respiratory rate
- peak inspiratory pressure
- plateau pressure
- mean airway pressure
- total PEEP
- pressure support
- pressure control / inspiratory pressure

Result:

- 15,378 transitions
- 8,426 ICU stays

By intervention:

- FiO2: 8,889
- PEEP: 3,356
- set RR: 2,752
- set VT: 381

This stricter pool is the preferred source for manual adjudication.

## Manual review

A balanced 100-event review sample was initially created with 25 events per intervention.

The initial random sample showed that only 22/100 met the later tighter isolation/timing/context screen. Therefore, the manual-review cohort should be regenerated from the stricter 15,378-event pool rather than spending review effort on weaker events.

## Confounder screening in progress

Next automated flags are being added for nearby:

### Hemodynamic support
- norepinephrine
- epinephrine
- phenylephrine
- vasopressin
- dopamine
- dobutamine

### Sedation / analgesia
- propofol
- dexmedetomidine
- midazolam
- fentanyl
- morphine
- ketamine

The purpose is not to automatically exclude all exposed patients. The purpose is to identify major concurrent treatment changes that could confound attribution of HR, MAP, respiratory effort, or gas-exchange responses to the ventilator intervention.

## Model-integrity rule

Do not tune HumMod physiology from post-transition outcomes during cohort adjudication.

For every accepted event:

1. initialize the model only from data available before the transition;
2. freeze the state;
3. apply the observed ventilator intervention;
4. generate a blinded forward prediction;
5. compare the prediction with the observed post-transition physiology.

## Current next steps

1. Add vasoactive and sedative confounder flags.
2. Generate a new balanced 100-event manual-review sample from the strict pool.
3. Review surrounding ventilator, respiratory, ABG, HR, MAP and SpO2 timelines.
4. Lock inclusion/exclusion rules.
5. Freeze the first validation cohort.
6. Run HumMod predictions without post-transition leakage.
7. Compare against persistence, population-average response and simple empirical baselines.


## Confounder flag update

Automated nearby-treatment flags have now been added to the strict transition pool using MIMIC input events.

Screening window:

- medication start time within +/-60 minutes of the ventilator transition

Flagged vasoactive agents:

- norepinephrine
- epinephrine
- phenylephrine
- vasopressin
- dopamine
- dobutamine

Flagged sedation / analgesia agents:

- propofol
- dexmedetomidine
- midazolam
- fentanyl
- morphine
- ketamine

Aggregate results in the 15,378-event strict pool:

- no nearby vasoactive or sedative start: 4,187
- nearby vasoactive start: 7,310
- nearby sedative/analgesic start: 8,792
- both flags present: 4,911

A new balanced 100-event manual-review sample was generated from the strict pool, prioritizing events without either flag:

- FiO2: 25
- PEEP: 25
- set RR: 25
- set VT: 25
- all 100 sampled events have neither nearby-start flag

Important limitation:

This is a first-pass confounder screen. It detects medication starts near the transition. It does not yet prove absence of an ongoing infusion, dose titration, bolus outside the exact item list, or another hemodynamic/sedative intervention. Manual review and a later rate-change screen are still required.

## Updated next steps

1. Build a local timeline packet for each of the 100 strict review events.
2. Add ongoing-infusion and dose-change flags for vasoactive and sedative agents.
3. Adjudicate the 100 events using the predefined categories.
4. Use adjudication results to lock final inclusion/exclusion rules.
5. Freeze the first validation cohort.
6. Run blinded HumMod predictions from pre-transition data only.
7. Compare HumMod with persistence, population-average response, and simple empirical baselines.


## Confounder-screen correction

The first medication screen only excluded nearby medication starts. That was insufficient because many events still had an infusion active across the ventilator transition.

A stronger screen now distinguishes:

- medication start within +/-60 minutes;
- medication infusion active at the transition.

In the 15,378-event strict pool:

- vasoactive infusion active at transition: 8,486
- sedative/analgesic infusion active at transition: 12,049
- fully unconfounded by the current medication definition: 2,194

For this first validation pilot, "fully unconfounded" means:

- no active vasoactive infusion at the transition;
- no active sedative/analgesic infusion at the transition;
- no vasoactive start within +/-60 minutes;
- no sedative/analgesic start within +/-60 minutes.

A corrected balanced 100-event review sample was generated from those 2,194 events:

- FiO2: 25
- PEEP: 25
- set RR: 25
- set VT: 25

Verification of the corrected 100-event sample:

- active vasoactive infusion: 0/100
- active sedative/analgesic infusion: 0/100

A local timeline packet was generated for all 100 events. It contains nearby ventilator settings, respiratory mechanics, HR/MAP/SpO2, arterial blood gases, and relevant medication events. Patient-level timeline data remain local and are not committed to GitHub.

### Remaining limitation

The current medication screen is based on the selected MIMIC item list and documented input-event timing. It does not yet prove absence of every possible hemodynamic or sedative confounder, undocumented bolus, or medication outside the selected item list. Manual adjudication remains required.


## Procedure / airway confounder screen

The corrected 100-event manual-review sample was also screened for nearby major airway, procedure, recruitment, SBT, and ECMO activity.

Procedure-event flags within +/-2 hours included:

- intubation
- extubation, including unplanned extubation
- bronchoscopy
- percutaneous or open tracheostomy
- chest-tube placement or removal
- ECMO inflow/outflow line procedures

Chart-event flags within +/-2 hours included:

- recruitment maneuvers
- SBT start/stop/completion
- ECMO flow/sweep/FiO2 context

ECMO chart context was also checked within +/-6 hours.

Result in the corrected 100-event sample:

- nearby major airway/procedure event: 0/100
- recruitment/SBT/ECMO event within +/-2 hours: 0/100
- ECMO context within +/-6 hours: 0/100
- none of the above: 100/100

This is an automated screen based on the selected MIMIC item IDs. Manual timeline adjudication remains the final check.


## Official MIMIC ventilation-status classification

The first-study cohort is now restricted using the official MIT-LCP MIMIC ventilation concept rather than an ad hoc airway-type rule.

Source:

- MIT-LCP mimic-code
- `mimic-iv/concepts/treatment/ventilation.sql`
- https://github.com/MIT-LCP/mimic-code/blob/main/mimic-iv/concepts/treatment/ventilation.sql

The local implementation follows the published MIMIC logic:

- combines ventilator mode with oxygen-delivery device documentation;
- classifies episodes as:
  - InvasiveVent
  - Tracheostomy
  - NonInvasiveVent
  - HFNC
  - SupplementalOxygen
  - None
- uses the MIMIC priority order for conflicting documentation;
- groups ventilation states into episodes using the MIMIC 14-hour gap rule.

Local episode counts:

- InvasiveVent: 44,533
- Tracheostomy: 19,867
- NonInvasiveVent: 7,842
- HFNC: 5,106
- SupplementalOxygen: 96,140
- None: 64,008

The official MIMIC concept is also used by MIMIC-derived analyses such as SOFA when determining whether an arterial blood gas occurred during invasive ventilation.

### Medication-clean transitions by ventilation status

After the strict timing/context screen and medication-confounder screen:

- InvasiveVent: 1,865 transitions / 1,175 ICU stays
- Tracheostomy: 190 / 95
- SupplementalOxygen: 91 / 90
- unclassified: 81 / 75
- NonInvasiveVent: 25 / 18
- HFNC: 13 / 13

Only `InvasiveVent` is retained for the first validation cohort.

Invasive transitions by intervention:

- FiO2: 1,112
- PEEP: 420
- set RR: 297
- set VT: 36

## Final automated screening before manual review

The 1,865 invasive transitions were screened for:

- intubation/extubation;
- bronchoscopy;
- tracheostomy;
- chest-tube procedures;
- recruitment maneuvers;
- SBT activity;
- ECMO procedures or chart context.

Result after this screen:

- 1,766 transitions
- 1,090 ICU stays

By intervention:

- FiO2: 1,038
- PEEP: 397
- set RR: 295
- set VT: 36

A final balanced 100-event review sample was generated:

- FiO2: 25
- PEEP: 25
- set RR: 25
- set VT: 25

Verification of the final 100-event sample:

- active vasoactive infusion at transition: 0/100
- active sedative/analgesic infusion at transition: 0/100
- nearby major airway/procedure event: 0/100
- recruitment/SBT/ECMO flag: 0/100
- ECMO context: 0/100

The local timeline packet for these 100 events contains 7,965 nearby chart, blood-gas, and medication records. Patient-level timeline data remain local and are not committed to GitHub.

## Identifiability note

Requiring FiO2, PEEP, set RR, set VT, and ventilator mode for every event is not appropriate because the cohort contains multiple ventilator modes with different required control variables.

The initialization rule will therefore be mode-specific. Missing settings will not be imputed as normal or assumed absent. The mode-specific requirement will be defined before HumMod prediction runs.


## HumMod mode-support gate

The deployed v1.5 engine currently exposes four executable ventilator controller modes:

- VC_AC
- PC_AC
- PS
- SIMV

Relevant runtime tests were executed directly against the current `ards-twin-v1.0` code:

- PC-AC mechanics: 6/6 assertions passed
- Hennigs pressure-support integration: passed
- live Hennigs-supported PS/SIMV execution and VC-to-PS transition: passed
- SIMV candidate triggering/cycling: passed
- live HumMod session boundary:
  - finite gas and circulation outputs: passed
  - dynamic catecholamine pools: passed
  - PEEP intervention persists through live systemic state: passed
  - PEEP challenge produces cardiopulmonary/autonomic response: passed
  - FiO2/VC setting changes feed the live core at breath boundaries: passed
  - HumMod 2012/2013 HR candidate produces marked tachycardia before terminal reserve loss: passed

Important implementation note:

Some user-facing explanatory text still says that only the reference aspiration case in VC-AC is supported. That text lags the current controller/runtime implementation. For research validation, mode eligibility is based on tested executable runtime paths, not the stale UI wording.

## Conservative MIMIC-to-HumMod mode map

Adaptive or vendor-specific modes are not silently converted to a simpler mode.

Accepted mappings for the first validation pass:

- `SPONT`, `CPAP/PSV`, `PSV/SBT`, `CPAP/PPS` -> HumMod `PS`, with documented pressure support.
- `P-CMV`, `PCV+Assist`, `PRES/AC` -> HumMod `PC_AC`, with documented set RR and inspiratory pressure.
- `VOL/AC`, `CMV/ASSIST`, `CMV` -> HumMod `VC_AC`, with documented set RR and set VT.
- explicit `SIMV/PSV` or `SIMV/PRES` -> HumMod `SIMV`, only if the mandatory pressure/rate and PS inputs required by the current controller are documented.

Excluded from the first pass rather than approximated:

- APV (cmv)
- ASV
- AutoFlow variants
- PRVC
- APRV
- ambiguous/missing mode
- other vendor-specific adaptive modes without a one-to-one current controller analogue

Result after all prior invasive, timing, medication, and procedure screens:

- 411 directly supported transitions
- 293 ICU stays

By HumMod mode:

- PS: 333 transitions / 265 stays
- PC_AC: 70 / 23
- VC_AC: 8 / 6
- SIMV: 0

By intervention:

- FiO2: 230
- PEEP: 158
- set RR: 19
- set VT: 4

This pool is sufficient for an initial FiO2/PEEP validation, but it is not sufficient for a balanced four-intervention validation without adding or qualifying adaptive ventilator modes.

## Assisted-mode effort identifiability

Pressure-support validation requires a patient-effort state. Wakefulness or sedation is not assumed from the mode.

The existing Hennigs-supported effort profiles are candidate latent states:

- passive / paralyzed
- sedated but breathing
- awake / cooperative
- agitated / high drive

For PS events, effort-state selection will use pre-transition respiratory observations only and will then be frozen before applying the ventilator change.

Among the 333 directly supported PS transitions:

- spontaneous RR available: 318
- total RR available: 279
- observed VT available: 318
- minute ventilation available: 324
- at least two of these four observables: 326
- total RR + observed VT + minute ventilation: 273

A local pre-fit target dataset has been generated:

- 326 PS transitions
- 258 ICU stays
- 273 transitions with the strongest three-observable set

No post-transition data will be used to select the effort profile.

## Current scientific decision point

Two paths are available:

1. Validate the model now using only directly supported modes.
   - Main first-study interventions: FiO2 and PEEP.
   - Include PS only after pre-transition Hennigs effort-state fitting is implemented and frozen.
   - Avoid changing the simulator to make the retrospective cohort larger.

2. Add and qualify adaptive ventilator modes such as APV/ASV/AutoFlow before validation.
   - This would recover a much larger fraction of the MIMIC cohort.
   - It would also change the simulator before validation and add a substantial new model-validation burden.

The conservative research path is Path 1: validate what the current tested model can represent before extending it.


## Pre-transition phenotype implementation

The first phenotype preparation layer is now implemented.

Local outputs:

- `phenotype_inputs.parquet`
- `phenotype_fit_plan.parquet`

No patient-level phenotype rows are committed to GitHub.

### Identifiability in the 411-event supported-mode pool

- Grade A: 396
- Grade B: 8
- Grade C: 7
- eligible for primary pre-fitting (A or B): 404

### Parameter-identification status

Compliance:

- measured/derived: 39
- measured/documented: 135
- fit from pre-transition state: 230
- not identifiable: 7

Resistance:

- measured/documented: 159
- fit from pre-transition state: 15
- prior-constrained: 237

Effective shunt:

- fit: 404
- not identifiable: 7

Effective dead-space behavior:

- fit: 399
- prior-constrained: 12

Patient effort:

- fit discrete Hennigs profile: 326
- not applicable in controlled mode: 78
- not identifiable: 7

Recruitability:

- prior-constrained: 411

Hemodynamic sensitivity to airway pressure:

- prior-constrained: 411

Autonomic response gain:

- prior-constrained: 411

The latter three are deliberately not inferred from a single operating point. They require earlier pre-index perturbation history or an independent measurement.

### Important runtime boundary

The current live HumMod session still constructs lung mechanics from the reference aspiration case. Therefore, the phenotype preparation layer does not yet run patient-specific predictions. A research-only patient-mechanics initialization boundary is required before phenotype fitting can be coupled to HumMod.

The production/default reference behavior must remain unchanged when no patient-specific override is supplied.


## Patient-specific mechanics runtime boundary

A research-only patient-mechanics override has been added to the live HumMod session constructor.

New optional input:

- `patientMechanicsParams`

Behavior:

- when omitted, the session uses the existing authored reference-case mechanics exactly as before;
- when supplied, the full mechanics object is validated through the existing `makePatientParams` contract;
- the snapshot records:
  - `patientMechanicsSource`
  - `patientMechanicsOverrideApplied`

Provenance values:

- `reference-case`
- `patient-specific-research-override`

This does not remove the authored reference-case restriction for other HumMod engineering boundaries. It only creates the controlled mechanics injection point needed for phenotype research.

Regression test:

- default reference mechanics provenance: passed
- patient-specific override provenance: passed
- doubling central airway resistance increases VC peak airway pressure: passed
- full live-session regression suite: 10/10 tests passed

This boundary allows a future phenotype fitter to inject fitted patient mechanics without changing the deployed/default behavior when no override is supplied.


## Pre-index perturbation history

To improve identifiability without post-index leakage, the pipeline now searches for earlier PEEP transitions in the same ICU stay.

History window:

- historical PEEP transition: 24 to 2 hours before the index transition
- historical pre/post ABG and mechanics responses must occur before the index transition

Local historical dataset:

- 224 historical PEEP perturbations
- supports 135 index events
- 97 ICU stays
- paired pre/post compliance available for 13 historical perturbations
- paired pre/post HR and MAP available for 217 historical perturbations

At the index-event level:

- recruitability can be fit from pre-index PEEP history in 135/411 events
- airway-pressure hemodynamic sensitivity can be fit from pre-index PEEP history in 130/411 events
- recruitability remains prior-constrained in 276/411
- hemodynamic sensitivity remains prior-constrained in 281/411

Autonomic gain remains prior-constrained in all 411 events. A PEEP-associated HR/MAP response alone cannot uniquely separate autonomic gain from preload/afterload and other hemodynamic effects.

All historical identification data precede the index transition. Post-index values remain excluded from phenotype fitting.


## Patient-specific dead-space runtime boundary

A second research-only phenotype boundary has been added:

- `patientDeadSpaceBtpsMl`

Behavior:

- when omitted, the existing HumMod legacy dead-space equation remains unchanged;
- when supplied, the explicit patient dead-space value is passed through the live pulmonary boundary;
- the snapshot records:
  - `patientDeadSpaceOverrideApplied`
  - `patientDeadSpaceBtpsMl`

No direct shunt-fraction override was added.

Reason:

- in the current coupled model, alveolar shunt emerges from compartment perfusion fractions and recruitment state;
- a separate direct shunt knob would bypass that structure and could hide model misspecification;
- right-to-left shunt remains the explicit HumMod source-aligned baseline component.

Regression test:

- default dead-space behavior retained: passed
- explicit dead-space provenance: passed
- increased explicit dead space raises PaCO2 at fixed VC settings: passed
- full live-session regression suite: 11/11 tests passed

The runtime now has explicit phenotype injection points for patient mechanics and dead space while preserving default reference behavior when no override is supplied.


## Numerical phenotype fitter: controlled modes

The first numerical phenotype fitter is now implemented for directly mapped controlled modes (VC_AC and PC_AC).

### Additional controller-state extraction

MIMIC controller timing/flow fields were added:

- 224691 Flow Rate (L/min)
- 224738 Inspiratory Time
- 226873 Inspiratory Ratio

Local extraction:

- 1,003,699 timing/flow rows
- Flow Rate: 351,146 rows / 16,408 ICU stays
- Inspiratory Time: 422,123 / 36,890
- Inspiratory Ratio: 230,430 / 21,951

Coverage in the controlled-mode fit pool:

- PC_AC: 70 candidate transitions
  - flow documented: 63
  - inspiratory time documented: 69
  - at least one timing/flow descriptor: 70
- VC_AC: 8 candidate transitions
  - inspiratory time documented: 6
  - flow documented: 1
  - inspiratory ratio documented: 8

Two VC events were excluded from the numerical fit because neither a usable inspiratory time nor flow was available. One PC event lacked a usable inspiratory time for the current controller mapping.

Final numerical controlled-mode fit set:

- 75 events
- 69 PC_AC
- 6 VC_AC

### Patient arterial gas initialization

A patient-specific arterial gas initialization boundary was added.

Inputs:

- pre-transition PaO2
- pre-transition PaCO2
- measured pH retained as a diagnostic

Implementation:

- arterial HCO3 state is generated from PaCO2 using the existing HumMod gas-to-base relation at the fixed SID boundary;
- arterial O2 content is generated from PaO2 using the existing HumMod hemoglobin/O2-content relation;
- the source venous gas state remains the prior because no patient venous measurement is available;
- no patient-specific SID is invented to force pH.

The raw initializer reproduces supplied PaO2 and PaCO2 to numerical tolerance before the required one-second coupled initialization step.

Measured pH is not used in the pulmonary fit objective because the reduced core currently determines pH from its fixed SID boundary. The pH residual remains visible as a structural-model residual.

### Controlled-mode fitting parameters

The current bounded fitter varies only model-native pre-transition phenotype parameters:

- global lung stiffness scale;
- central airway resistance;
- fixed nonventilated perfusion fraction, implemented by redistributing compartment perfusion while preserving total perfusion = 1;
- dead space as a fraction of delivered tidal volume.

Baseline recruitment is held at the reference prior in this fitter. Dynamic recruitability is reserved for the separate pre-index PEEP-history fit.

No direct shunt-fraction correction or post-index information is used.

### PC inspiratory-pressure interpretation check

For 68 PC_AC events with both Pinsp and peak airway pressure documented:

- median |Ppeak - Pinsp| = 12 cmH2O
- median |Ppeak - (PEEP + Pinsp)| = 2 cmH2O

This supports interpreting the mapped MIMIC Pinsp field as pressure above PEEP for the current PC_AC controller.

### 75-event controlled-mode fit results

All 75 events completed the bounded numerical fit and a higher-fidelity confirmation run.

Normalized fit-score distribution:

Gas score:
- median: 1.42
- 75th percentile: 5.10
- 90th percentile: 10.98
- 95th percentile: 76.74
- maximum: 286.41

Mechanics score:
- median: 1.07
- 75th percentile: 2.20
- 90th percentile: 5.70
- 95th percentile: 8.49
- maximum: 24.66

Counts using the pre-specified objective normalization:

- gas score <=2: 42/75
- gas score >10: 9/75
- gas score >25: 5/75
- mechanics score <=3: 61/75
- mechanics score >10: 4/75
- both gas <=2 and mechanics <=3: 35/75
- either gas >10 or mechanics >10: 12/75

Median absolute confirmed residuals:

- PaO2: 14.4 mmHg
- PaCO2: 3.1 mmHg
- pH: 0.080 (diagnostic only; fixed-SID structural residual)
- SpO2: 3.9 percentage points
- VT: 44 mL
- minute ventilation: 0.77 L/min
- peak airway pressure: 2 cmH2O

### Gas-exchange failure phenotype

The clear gas-fit failures are not explained by an intervening material ventilator change between the pre-ABG and index transition:

- 73/75 controlled fits have no material ventilator transition between pre-ABG and index transition;
- all 9 gas-score >10 cases are in that stable subset;
- all 5 gas-score >25 cases are also in that stable subset.

The gas-score >10 subgroup is strongly hyperoxic at baseline:

- median pre-transition PaO2: 228 mmHg
- median FiO2: 60%
- median PEEP: 10 cmH2O

For gas-score <=10:

- median pre-transition PaO2: 75.5 mmHg
- median FiO2: 55%
- median PEEP: 10 cmH2O

Interpretation:

The current reduced gas-exchange model cannot preserve some high-PaO2 states under its present recruitment/perfusion/shunt structure, even after fitting a model-native nonventilated-perfusion parameter. These cases are retained as model-mismatch cases and are not tuned away.

### Controlled-mode prefit quality

The baseline fitter is a pre-index representability test, not an outcome model.

The current result supports separating:

- well-represented baseline phenotypes;
- gas-exchange mismatch phenotypes;
- mechanics mismatch phenotypes;
- combined mismatch phenotypes.

Any primary-validation eligibility rule based on these pre-transition fit residuals must be frozen before post-transition outcomes are examined.
