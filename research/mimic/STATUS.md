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


## Baseline representability policy frozen before outcome evaluation

The numerical prefit residual is a technical model-representability measure, not a clinical severity score.

Primary handling:

- retain gas and mechanics prefit scores as continuous variables;
- do not use post-transition outcomes to alter fit bounds, weights, or phenotype eligibility;
- do not discard model-mismatch events solely to improve post-transition prediction performance.

Pre-specified diagnostic strata for model-development reporting:

- **well represented:** gas score <=2 AND mechanics score <=3
- **clear baseline mismatch:** gas score >10 OR mechanics score >10
- **intermediate:** all other completed fits

These cut points are tied to the already-defined normalized fitting objective. They are engineering/model-quality strata, not clinical thresholds.

In the 75-event controlled-mode cohort:

- well represented: 35
- clear baseline mismatch: 12
- intermediate: 28

For primary predictive analyses, baseline fit quality will be reported and used for stratified/sensitivity analysis. Any decision to exclude clear baseline-mismatch cases from a primary patient-specific prediction endpoint must be specified before viewing post-transition prediction errors.

### Assist-control effort caveat

Among 70 mapped PC_AC transitions:

- total RR documented: 68
- total RR > set RR by >1/min: 15
- spontaneous RR documented: 6
- spontaneous RR >0: 1

The current PC_AC controller does not transmit Hennigs patient effort. Therefore, PC_AC events with evidence of patient-triggered breathing must be flagged as possible assist-control effort mismatch. The mechanics fitter must not interpret this automatically as altered compliance.


## Pressure-support phenotype fitting

The PS phenotype fitter now separates respiratory frequency drive from effort transmission.

### Source-bounded continuous drive

Hennigs relative neural drive (`dRel`) is fit continuously within the existing Hennigs-supported frequency envelope:

- minimum: 0.09686299285820986
- maximum: 1.1105014884421243

This is the source-supported frequency/drive coordinate already implemented by the Hennigs oscillator.

The four existing patient-state profiles remain as discrete muscle-transmission anchors:

- passive_paralyzed
- sedated_breathing
- awake_cooperative
- agitated_high_drive

The transmission scalar is **not** converted into a free continuous patient-fit parameter because it is an integration bridge rather than an independently validated Hennigs patient parameter.

### PS controller priors held fixed

The following controller settings are not fitted from MIMIC:

- flow trigger: 1.5 L/min
- cycle-off fraction: 0.25
- rise time: 0.1 s
- backup rate: 2/min

These are explicit engineering/controller priors. The low backup rate is used so spontaneous Hennigs effort, not the backup clock, determines the observed PS breathing pattern when effort is present.

### PS fit cohort

Pre-transition PS events eligible for effort fitting:

- 326 transitions
- total RR available: 279
- spontaneous RR available: 318
- observed VT available: 318
- minute ventilation available: 324

Fit targets use only pre-index data.

### Initial discrete-profile-only pilot

In the first five PS events, fitting only the four discrete profiles produced:

- median effort score: 7.31
- median absolute RR error: 7.0/min
- median absolute VT error: 79 mL

This showed that the discrete profiles were too coarse for patient-specific respiratory frequency.

### Continuous-dRel pilot

After adding continuous Hennigs dRel while retaining discrete transmission profiles, the same five events produced:

- median effort score: 0.38
- median absolute RR error: 2.0/min
- median absolute VT error: 9 mL

This supports dRel as the patient-specific respiratory-drive phenotype coordinate.

### Thirty-event PS sample

A 30-event pre-index PS sample was then fit with:

- continuous Hennigs dRel;
- discrete transmission profile;
- global stiffness scale;
- documented resistance when available, otherwise prior;
- model-native fixed nonventilated perfusion fraction;
- dead space;
- patient arterial gas initialization.

Profile selection:

- agitated_high_drive: 17
- awake_cooperative: 7
- sedated_breathing: 5
- passive_paralyzed: 1

Effort score:
- 25th percentile: 0.36
- median: 1.01
- 75th percentile: 4.73
- 90th percentile: 14.57
- maximum: 65.77
- effort score <=2: 17/30
- effort score >10: 5/30

Median absolute prefit residuals:

- RR: 2.0/min
- VT: 72 mL
- minute ventilation: 0.80 L/min
- PaCO2: 0.92 mmHg
- PaO2: 42 mmHg

Gas mismatch remains separable from effort mismatch:

- gas score <=2: 10/30
- gas score >10: 11/30
- both effort <=2 and gas <=2: 5/30

### Effort-amplitude limitation

The remaining VT mismatch must not be removed by freely fitting the project-created muscle-transmission scalar. The current source-supported approach therefore retains:

- continuous Hennigs dRel for frequency/drive;
- discrete transmission anchors for effort amplitude;
- explicit residuals when MIMIC VT/minute ventilation cannot be represented.

This preserves the distinction between source-supported physiology and project-created integration assumptions.


### Pressure-support representability policy frozen before outcome evaluation

Primary handling:

- retain effort and gas prefit scores as continuous variables;
- report the two domains separately;
- do not change Hennigs drive bounds, transmission profiles, gas-fit bounds, or score weights based on post-transition prediction performance.

Pre-specified diagnostic strata:

- **well represented PS phenotype:** effort score <=2 AND gas score <=2
- **clear PS baseline mismatch:** effort score >10 OR gas score >10
- **intermediate:** all other completed PS fits
- **runtime-unrepresentable:** fail-closed candidate execution; retained as a separate model-limit category

These are technical model-quality strata, not clinical thresholds.

No post-transition MIMIC observation has been used to define these strata.


## Controlled-mode numerical mechanics fitter

The first numerical phenotype fitter is now implemented for controlled modes.

Input cohort:

- 77 controlled-mode events with complete controller timing:
  - PC_AC
  - VC_AC
- one PC_AC event lacking adequate timing information was excluded rather than assigned a guessed inspiratory time.

Additional raw MIMIC controller variables extracted:

- 224691 Flow Rate
- 224738 Inspiratory Time
- 226873 Inspiratory Ratio

Local extraction:

- 1,003,699 timing/flow rows

Coverage in the controlled-mode phenotype cohort:

- PC_AC: 63/70 flow, 69/70 inspiratory time
- VC_AC: 1/8 direct flow, 6/8 inspiratory time, 8/8 inspiratory ratio

VC flow is derived only when MIMIC records either inspiratory time or inspiratory ratio plus RR and VT.

### Fitter structure

The mechanics stage is intentionally separate from gas/systemic fitting.

Fitted candidate parameters:

- global mechanics stiffness scale
- central airway-resistance scale
- initial recruitable fraction only when pre-index PEEP history permits recruitability fitting

No post-index observations are used.

Synthetic recovery test:

- PC_AC known grid parameters: exactly recovered
- VC_AC known grid parameters: exactly recovered

### Controlled-mode fit result

- 77 events processed
- 75 finite mechanics fits
- 2 events had no usable mechanics target and therefore returned no fit
- solver failures: 0

Normalized objective distribution among finite fits:

- median: 0.068
- <=0.05: 32
- <=0.10: 43
- <=0.25: 53
- <=0.50: 59
- <=1.00: 68
- >1.00: 7
- >2.00: 4

The objective is the mean squared residual after scaling each fitted mechanics target by its predefined tolerance. An objective near 1 therefore means approximately one tolerance unit RMS error.

Search-boundary hits show weaker identifiability for resistance than for global stiffness:

- stiffness low edge: 1
- stiffness high edge: 19
- resistance low edge: 31
- resistance high edge: 19

Boundary hits are recorded as identifiability warnings. They are not interpreted as true physiologic extremes.

### Gas-fit initialization rule

The reduced HumMod gas runtime begins from its source-aligned initial gas state. Patient arterial O2 content and venous state will not be synthesized from ABG values using ad hoc inverse formulas.

Gas fitting will instead:

1. use the recorded pre-transition ventilator state;
2. use fitted mechanics and allowed recruitment state;
3. equilibrate the live coupled model before the index intervention;
4. compare the equilibrated pre-transition gas state with the observed arterial ABG;
5. fit only allowed gas parameters such as explicit dead space;
6. freeze the phenotype before applying the index transition.


## Integrated pre-transition phenotype fitting

The controlled-mode integrated phenotype fitter has now been run across all 77 controlled-mode events using the committed patient gas-initialization boundary.

Controlled-mode representability:

- well-represented: 36
- intermediate: 28
- clear baseline mismatch: 13

Aggregate controlled fit scores:

- median gas score: 1.371
- median mechanics score: 1.067
- gas score >10: 9
- mechanics score >10: 5

Quality definitions follow the existing freeze workflow:

- well-represented: gas <=2 and mechanics <=3
- clear baseline mismatch: gas >10 or mechanics >10
- otherwise: intermediate

The integrated fitter initializes the pre-transition arterial gas state from the measured pre-transition PaO2/PaCO2/pH through the source-bounded patient gas initialization module, then measures drift under unchanged recorded ventilation. It does not use post-index outcomes.

## Pressure-support phenotype fitting

The previously completed source-bounded PS fit consists of 326 events.

PS representability:

- well-represented: 101
- intermediate: 119
- clear baseline mismatch: 94
- fit/runtime failure: 12

Aggregate PS scores:

- median effort score: 0.603
- median gas score: 2.894

Selected Hennigs latent effort profile among successful PS fits:

- agitated_high_drive: 200
- awake_cooperative: 54
- sedated_breathing: 54
- passive_paralyzed: 6

These labels are model latent-state labels only. They must not be interpreted as documented clinical wakefulness, agitation, paralysis, or sedation unless independently documented.

The high frequency of the high-drive profile is a model-fit diagnostic and may indicate limited granularity of the current four-profile effort representation, unmodeled patient-ventilator interaction, or residual physiologic heterogeneity. It is not evidence that most patients were clinically agitated.


## Blinded prediction runtime and freeze

A separate blinded prediction runner has now been implemented.

### Separation from outcomes

The prediction runner opens only:

- frozen phenotype parameters;
- pre-transition phenotype-fit inputs;
- a minimal local event bridge containing:
  - stable event ID;
  - mapped HumMod mode;
  - transition item ID;
  - observed ventilator setting after the transition.

It does **not** open or join post-transition ABG, HR, MAP, SpO2, or other outcome values.

Prediction horizons are fixed in advance:

- 5 minutes
- 15 minutes
- 30 minutes
- 60 minutes

Predicted outputs include:

- PaO2
- PaCO2
- pH
- SaO2
- HR
- MAP
- cardiac output
- tidal volume
- minute ventilation
- peak airway pressure

### Prediction-eligibility gate

In addition to a `well-represented` pre-transition phenotype, the index intervention must be executable in the mapped controller:

- FiO2: VC_AC, PC_AC, or PS
- PEEP: VC_AC, PC_AC, or PS
- set RR: VC_AC or PC_AC
- set VT: VC_AC only

One otherwise well-represented event had a set-VT transition while mapped as PC_AC. It is excluded from the blinded prediction cohort rather than approximated.

Final prediction-eligible cohort:

- 136 events

### Long-run numerical/runtime safeguards

Several pre-outcome runtime issues were found and corrected before prediction freeze.

#### Trace compaction

Long simulations retained every high-frequency trace row and became progressively slower.

A research runtime method now retains only recent trace history during long predictions.

Regression test:

- compacted vs uncompacted PaO2: identical
- PaCO2: identical
- HR: identical
- MAP: identical
- recent trace remains bounded

This changes memory/history retention only, not physiology.

#### Fractional dead-space phenotype

A fitted absolute dead-space value could become larger than tidal volume after a ventilator change.

The phenotype already fits dead space as a fraction of VT. Prediction now carries that dimensionless phenotype forward and recomputes dead space from current delivered VT.

Regression test across a VC tidal-volume reduction: passed.

#### Assisted-controller rollback

Simulation rollback assumed every ventilator controller owned a BreathTracker. Assisted PS/SIMV controllers do not.

Rollback now restores tracker state only when a tracker exists.

Existing assisted-mode regression test: passed.

#### Numerical closure floor

During a long assisted-mode run, recruitable availability could decay into the floating-point subnormal range (~1e-315), where finite-capacity domain checks become numerically unstable.

Recruitment availability <=1e-12 is now treated as numerically closed.

This is a numerical zero/closure floor, not a physiologic calibration change.

Regression tests:

- conservation: 8/8 passed
- recruitment: 7/7 passed
- assisted modes: passed
- trace-compaction invariance: passed

#### Physician validation candidate

The parallel physician validation candidate is observational only and has no control authority.

Its invariance test confirms that enabling/disabling it does not change canonical live physiology.

The blinded prediction runner therefore disables this diagnostic candidate to reduce runtime and eliminate irrelevant comparison-layer failure modes. The general runtime PS fallback was also corrected so the candidate remains valid when enabled.

### Final regression state

Full live HumMod session suite after these changes:

- 13/13 tests passed

### Blinded prediction freeze

Eight uniform prediction shards were run with the final configuration.

The one controller-incompatible event was removed by the prespecified executable-transition gate.

Frozen compatible predictions:

- eligible events: 136
- successful trajectories: 136
- missing: 0
- duplicate: 0
- eligible runtime failures: 0

Local frozen prediction file:

`/Users/philipbernard/mimic-data/derived/blinded_predictions_frozen.jsonl`

SHA-256:

`99c4cbac2574178c091133e9743e47561b97f64b608d7ea21a5f0605b988789b`

The patient-level prediction file remains local and is not committed to GitHub.

No post-transition MIMIC outcome file had been opened for prediction evaluation at the time this freeze was created.


## Freeze 2 stationarity gate

Freeze 1 evaluation identified a baseline-stability defect: phenotypes could match the measured ABG over a short confirmation window yet drift substantially under unchanged ventilation.

A new 60-minute no-intervention stationarity gate was therefore locked before opening outcomes for the Freeze 2 pool.

Outcome-unseen, non-P-CMV, fit-complete candidates tested:

- 221
- runtime-complete stationarity simulations: 221/221
- stationarity-pass: 85/221

Locked gas-stability criterion at 60 minutes:

- absolute PaCO2 drift <= 8 mmHg
- absolute PaO2 drift <= 20 mmHg

Pass counts by current mapped mode:

- PS: 83/213
- PC_AC: 1/4
- VC_AC: 1/4

## Freeze 2 controller-capability correction

Review of the current ventilator controllers showed that the implemented VC_AC and PC_AC controllers are time-triggered only.

They do not currently implement patient-triggered assist/control breaths.

Therefore, assist/control labels are not used in Freeze 2 even when a phenotype passes stationarity.

Freeze 2 is restricted to pressure-support modes that map directly to the current patient-triggered PS controller:

- SPONT
- CPAP/PSV
- PSV/SBT

CPAP/PPS is excluded because proportional pressure support is not equivalent to fixed pressure support.

PS set-RR changes are excluded because MIMIC set-RR semantics in these spontaneous modes are not assumed to equal the model backup-rate setting.

Final Freeze 2 pre-outcome prediction cohort:

- 81 events
- FiO2 transitions: 44
- PEEP transitions: 37
- SPONT: 45
- CPAP/PSV: 35
- PSV/SBT: 1

All 81 events were outcome-unseen at cohort lock.


## Controlled-mode numerical phenotype fitter

A staged pre-transition mechanics fitter has now been implemented and tested for directly supported controlled modes.

### Ventilator timing/flow extraction

Additional MIMIC chart variables were extracted from raw `chartevents`:

- 224691 Flow Rate (L/min): 351,146 rows / 16,408 stays
- 224738 Inspiratory Time: 422,123 rows / 36,890 stays
- 226873 Inspiratory Ratio: 230,430 rows / 21,951 stays

Coverage in the controlled-mode phenotype pool:

- PC_AC: inspiratory time available in 69/70
- VC_AC: all 8 have enough recorded inspiratory timing/ratio information to derive flow; one has a directly charted flow value

One PC_AC event lacks enough controller timing information and is excluded rather than assigned a guessed value.

Controlled fit-input set:

- 77 events
- 69 PC_AC
- 8 VC_AC

### Mechanics-fitter corrections

Two early fitter versions were rejected for methodology reasons before downstream use.

Rejected behavior:

1. resistance was allowed to vary when the event did not identify resistance;
2. current recruitable-compartment state was allowed to vary merely because pre-index PEEP history existed, although the baseline mechanics objective did not include that historical response;
3. plateau-derived MIMIC compliance was initially compared with a model value based on peak pressure rather than a true plateau hold.

The accepted v3 fitter corrects these problems.

### v3 identification rules

PC_AC:

- current recruitable-compartment state fixed during baseline mechanics fitting;
- central airway resistance fixed to the model prior;
- global lung stiffness is fit from observed pre-transition tidal volume;
- no resistance estimate is claimed from PC baseline VT alone.

VC_AC:

- current recruitable-compartment state fixed during baseline mechanics fitting;
- a validated inspiratory-hold measurement is used to obtain model plateau pressure;
- global stiffness is fit from plateau behavior;
- central airway resistance is fit only when both MIMIC peak and plateau pressure plus inspiratory flow are available.

A 10 ms measurement-only pause is used to enter the validated inspiratory-hold path for zero-pause retrospective VC settings. This pause is part of the measurement maneuver, not a patient ventilator-setting assumption.

Recruitability is not fit in this stage. It remains reserved for the separate pre-index PEEP-history objective.

### Synthetic recovery test

The v3 fitter was tested against synthetic data generated by the same mechanics engine.

- PC_AC: recovered the known stiffness grid value with resistance fixed to prior.
- VC_AC: recovered the known stiffness and resistance grid values from peak + completed plateau hold.
- test passed.

### Full controlled-mode v3 fit

Results across 77 fit inputs:

- valid mechanics fits: 75
- no usable mechanics target: 2
- solver failures: 0

Engineering fit-quality strata based on the normalized pre-transition objective:

- excellent (<0.1): 24
- good (0.1 to <0.5): 30
- fair (0.5 to <1.0): 6
- poor (>=1.0): 15
- unfitted: 2

These strata are QC descriptors, not clinical thresholds. Poor fits are retained as model-failure observations rather than silently discarded.

### Controlled-mode runtime compatibility

The current VC_AC and PC_AC controllers do not model patient-triggered extra mandatory breaths. Therefore, controlled-mode primary compatibility requires:

- total RR documented before the transition;
- absolute difference between total RR and set RR <=2 breaths/min;
- spontaneous RR absent or <=2 breaths/min.

Result:

- controller-compatible controlled events: 57
- all 57 have valid mechanics fits
- PC_AC: 55
- VC_AC: 2

Fit-quality distribution among the 57 controller-compatible events:

- excellent: 20
- good: 23
- fair: 4
- poor: 10

Mechanics fit quality remains continuous and will be used for sensitivity/failure analysis. Controller compatibility, not mechanics objective, is the representation gate for the next fitting stage.


## Freeze 3A index-path correction

A pre-freeze audit identified an index-path defect in the first stationarity-aware refit dry run.

The fitter loaded the broader `freeze3_dev_index.jsonl` instead of the locked `freeze3a_fio2_prefit_index.jsonl`.

This was detected before any Freeze 3A prediction freeze or outcome opening.

Actions completed:

- corrected fitter default index to `freeze3a_fio2_prefit_index.jsonl`;
- added fail-closed assertions for:
  - unique event IDs;
  - supported PS mode;
  - effort score <=2;
  - FiO2 intervention;
- quarantined 17 invalid local wrong-index refit artifacts;
- preflight validation of the corrected locked index passed.

Locked corrected cohort:

- 45 rows;
- 45 unique events;
- CPAP/PSV: 22;
- SPONT: 23;
- all remain outcome-unseen.

The wrong-index dry-run pass/fail counts are invalid and must not be used.


## Freeze 3A parameterization correction

A second pre-freeze implementation audit identified that `fit_ps_stationary.js` was not protocol-complete:

- it varied nonventilated perfusion even though Freeze 3A required that parameter to remain fixed;
- it omitted the required P_close/P_open threshold fit.

The incomplete workers were stopped. No prediction artifact or post-transition outcome was opened from that run.

Final locked implementation:

- `research/mimic/fit_freeze3a_locked.js`

The final script:

- uses only the 45-event locked Freeze 3A index;
- asserts unique IDs, supported PS modes, effort score <=2, and FiO2 intervention;
- keeps nonventilated perfusion fixed from the original PS phenotype;
- refits only current recruitment state, P_close/P_open, and dead-space fraction;
- preserves 10 cmH2O recruitment hysteresis width and existing recruitment kinetics;
- uses 15-minute pre-transition search trajectories;
- requires an independent 60-minute unchanged-ventilation confirmation;
- loads no post-index outcome values.

The older `fit_ps_stationary.js` now fails by default and can run only with an explicit development override.


## Controlled-mode numerical mechanics fitting

A bounded pre-transition mechanics fitter is now implemented for directly supported controlled modes.

Controller inputs are taken from MIMIC where available:

- VC_AC:
  - set VT
  - set RR
  - PEEP
  - FiO2
  - recorded inspiratory flow when available
  - otherwise flow is derived only from recorded inspiratory time or recorded inspiratory ratio
- PC_AC:
  - inspiratory pressure
  - set RR
  - PEEP
  - FiO2
  - recorded inspiratory time

Additional raw MIMIC extraction added:

- item 224691: Flow Rate (L/min)
- item 224738: Inspiratory Time
- item 226873: Inspiratory Ratio

Coverage in the controlled-mode cohort:

- PC_AC: 69/70 have recorded inspiratory time
- VC_AC: all 8 have sufficient recorded timing/ratio information to define inspiratory flow
- one PC_AC event is excluded from controlled fitting rather than assigned a guessed inspiratory time

Controlled fit input set:

- 77 events

Mechanics fitter:

- global stiffness scale
- central airway-resistance scale
- recruitable fraction only when the event has pre-index PEEP-history eligibility
- pre-transition targets only
- no post-index physiology is used

The fitter was first tested on synthetic PC_AC and VC_AC observations generated from known grid parameters. It exactly recovered the known stiffness, resistance, and recruitment grid values.

Full controlled-mode fit results:

- events attempted: 77
- finite best fit: 75
- no usable mechanics target: 2
- candidate simulations evaluated: 952
- solver failures: 0

Objective distribution among 75 finite fits:

- objective <= 0.05: 19
- <= 0.10: 24
- <= 0.25: 43
- <= 0.50: 54
- <= 1.00: 60
- <= 2.00: 72
- median objective: 0.181
- 90th percentile: 1.197
- maximum: 3.125

By mode:

- PC_AC: 67 finite fits; 53 objective <=1.0
- VC_AC: 8 finite fits; 7 objective <=1.0

Parameter-boundary diagnostics:

- stiffness-grid edge: 20/75
- resistance-grid edge: 3/75
- recruitment-grid edge among history-enabled fits: 0

Grid-edge fits are flagged as weakly constrained. The fitted point estimate must not be interpreted as a precise physiologic measurement.

For the next gas-exchange fitting stage, the conservative primary subset is the 60 controlled-mode events with finite mechanics objective <=1.0. Mechanics parameters are frozen before gas/dead-space fitting.


## Gas/dead-space fitting smoke test

A five-event controlled-mode smoke test was run after freezing the pre-transition mechanics fit.

Design:

- patient mechanics fixed from the pre-transition controlled-mode mechanics fit;
- documented ventilator settings fixed;
- measured pre-transition arterial PaO2/PaCO2 used to initialize the reduced HumMod gas state;
- measured pH retained as a diagnostic because the reduced core currently uses fixed SID and cannot independently initialize patient-specific pH;
- dead space represented as a fraction of tidal volume;
- tested fractions: 0.20, 0.35, 0.50, 0.65;
- 20-second pre-transition maintenance window;
- fitting target: PaCO2 maintenance only;
- pH and PaO2 are diagnostics, not fit targets.

Results:

- 4/5 events produced finite gas-maintenance runs.
- 1/5 failed at all tested dead-space fractions because the PC_AC live gas boundary did not obtain a finite delivered tidal volume for that event.
- In 3/4 finite events, the best tested fraction was the upper grid boundary (0.65), indicating the current range is insufficient or another gas-exchange/metabolic parameter is mismatched.
- One event maintained PaCO2 closely at fraction 0.65 (error approximately +0.3 mmHg).
- Other finite best-fit PaCO2 errors were approximately -10.3, -13.2, and -1.8 mmHg.
- PaO2 and pH residuals remained substantial in several events and are treated as model-mismatch diagnostics, not reasons to tune dead space.

Interpretation:

- dead-space fitting is technically feasible but is not yet ready to scale;
- boundary hits indicate that PaCO2 mismatch cannot be assumed to represent dead space alone;
- the next step is to diagnose the PC_AC delivered-VT failure and determine whether the high-boundary PaCO2 fits reflect dead-space range, metabolic CO2 production, venous-state initialization, or another model boundary.

No post-transition data were used.


## EtCO2-constrained dead-space phenotype

MIMIC item 228640 (EtCO2) is now paired with the nearest pre-transition arterial PaCO2.

Computed descriptor:

`(PaCO2 - PETCO2) / PaCO2`

This is stored as a measured PaCO2-PETCO2 gradient descriptor when timing is sufficiently close. It is not treated as identical to full Bohr/Enghoff physiologic dead-space fraction, which would require mixed expired CO2 rather than PETCO2.

Pairing results in the 411-event supported phenotype cohort:

- EtCO2/arterial PaCO2 pairs within +/-30 minutes: 33
- unique ICU stays: 30
- pairs within 10 minutes: 11
- pairs within 15 minutes: 14
- nonnegative fraction among all +/-30-minute pairs: 26
- negative gradient pairs: 7

Strict measured subset:

- timing <=15 minutes
- fraction between 0 and 0.8
- 11 events / 11 ICU stays
- PS: 8
- PC_AC: 3
- median measured fraction: approximately 0.10

Timing-quality grades:

- A: <=5 minutes and plausible fraction: 4
- B: >5 to <=15 minutes and plausible fraction: 7
- C: >15 to <=30 minutes and plausible fraction: 15
- none / unusable: 385

Phenotype policy:

- Grade A/B pairs are labeled `measured_paco2_petco2_gradient`.
- Grade C is retained as supportive context only.
- Patients without an A/B pair keep effective dead-space behavior as a latent/prior-constrained phenotype parameter.
- The measured gradient is a constraint on gas-exchange phenotype; it does not automatically equal the simulator's full effective dead-space fraction.

This replaces the earlier idea of fitting dead space blindly from PaCO2 alone whenever a close EtCO2 measurement is available.


## PC-AC EtCO2 dead-space validation

The first direct comparison between measured PaCO2-PETCO2 gradient and simulator dead-space fraction was run in the three strict PC_AC events with Grade A/B EtCO2 pairing.

Design:

- mechanics frozen from pre-transition mechanics fit;
- ventilator settings fixed to pre-transition MIMIC values;
- arterial gas state initialized from measured pre-transition PaO2/PaCO2;
- simulator dead-space fraction grid: 0.10 to 0.80;
- 20-second baseline-maintenance test;
- objective: absolute PaCO2 maintenance error;
- no post-transition data used.

Results:

1. measured gradient 0.022
   - simulator best dead-space fraction: 0.10
   - PaCO2 error: +1.6 mmHg
   - mechanics objective: 0.035

2. measured gradient 0.435
   - simulator best dead-space fraction: 0.60
   - PaCO2 error: -0.06 mmHg
   - mechanics objective: 1.03

3. measured gradient 0.102
   - simulator best dead-space fraction: 0.80 (upper search boundary)
   - PaCO2 error remained -5.5 mmHg
   - mechanics objective: 1.20

Interpretation:

- the lowest measured gradient maps to a low simulator dead-space fraction;
- the largest measured gradient maps to a high simulator dead-space fraction;
- the third case does not preserve monotonic ordering and also has a weak mechanics fit plus an upper-bound dead-space hit;
- three PC_AC cases are insufficient to establish a calibrated mapping;
- the measured PaCO2-PETCO2 gradient should therefore remain an independent measured phenotype constraint, not be converted directly into the simulator dead-space parameter with a fixed formula.

The next useful validation set is the eight PS events with Grade A/B EtCO2 pairing, but those require pre-transition effort-profile fitting before simulator dead-space can be interpreted.


## PS effort-profile smoke test

A two-event smoke test was run in the Grade A/B EtCO2 PS subset before scaling to all 8 events.

Design:

- tested Hennigs profiles:
  - passive_paralyzed
  - sedated_breathing
  - awake_cooperative
  - agitated_high_drive
- coarse stiffness grid fitted jointly with effort profile;
- resistance prior-constrained;
- PS backup rate fixed at 2/min, matching existing PS validation tests and well below observed patient RR;
- score used only pre-transition:
  - total RR
  - observed VT
  - minute ventilation
- candidates were rejected if ventilator breaths were not predominantly patient-effort triggered.

Results:

Event 1:
- observed RR 16/min, VT 417 mL, MV 6.6 L/min
- best discrete profile: sedated_breathing
- stiffness scale: 0.5
- model RR 12.1/min, VT 479 mL, MV 5.8 L/min
- objective 1.70
- all 5 ventilator breaths were associated with patient efforts

Event 2:
- observed RR 20/min, VT 289 mL, MV 5.8 L/min
- best discrete profile: awake_cooperative
- stiffness scale: 1.25
- model RR 12.3/min, VT 317 mL, MV 3.9 L/min
- objective 6.23
- all 5 ventilator breaths were associated with patient efforts

Interpretation:

- the PS backup rate is not driving the mismatch;
- the four discrete Hennigs profile states are too coarse to reproduce observed respiratory rates in these two patients;
- the existing continuous Hennigs-supported `patientDriveRelativeOverride` should therefore be fitted within its validated frequency envelope while retaining the discrete profile to represent muscle transmission / effort effectiveness.

No post-transition data were used.


## Two-axis PS effort phenotype

The initial PS effort fitting showed that the discrete Hennigs profile labels were too coarse once patient-specific respiratory drive was introduced.

Two-event continuous-drive smoke test:

Event 1:
- observed RR 16/min
- best continuous drive 0.20
- modeled RR 17.0/min
- target VT 417 mL; modeled VT 327 mL
- target MV 6.6 L/min; modeled MV 5.56 L/min
- objective improved to 0.92
- all ventilator breaths patient-effort triggered

Event 2:
- observed RR 20/min
- best continuous drive 0.35
- modeled RR 21.7/min
- target VT 289 mL; modeled VT 251 mL
- target MV 5.8 L/min; modeled MV 5.44 L/min
- objective improved to 0.36
- all ventilator breaths patient-effort triggered

Interpretation:

The patient-effort phenotype should not be represented only as a categorical profile label. The model now separates:

1. neural drive / respiratory timing:
   - patientDriveRelativeOverride
   - bounded inside the existing Hennigs-supported frequency envelope

2. muscle transmission / effort amplitude:
   - patientMuscleTransmissionOverride
   - bounded inside the existing implemented profile transmission envelope

The original patient-state profiles remain valid defaults, but research fitting can now override these two axes independently. This avoids calling a patient "agitated_high_drive" when the fitted neural drive is actually moderate and only the transmitted muscle effort is high.

Runtime changes:

- added optional patientMuscleTransmissionOverride
- snapshot records:
  - effectiveDriveRelative
  - driveOverrideApplied
  - effectiveMuscleTransmission
  - muscleTransmissionOverrideApplied
- live profile switching respects both overrides
- default behavior is unchanged when no overrides are supplied

Validation:

- dedicated muscle-transmission override test passed
- out-of-envelope transmission values are rejected
- full live-session regression suite: 14/14 tests passed

No post-transition data were used in the effort-fitting smoke tests.


## Eight-event PS effort fit in EtCO2 subset

The two-axis PS effort fitter was applied to all 8 Grade A/B EtCO2 PS events.

Method:

Stage 1:
- fit Hennigs-supported neural drive to pre-transition total RR;
- drive grid: 0.10, 0.20, 0.35, 0.50, 0.70, 0.95;
- PS backup rate fixed at 2/min;
- candidate required predominantly patient-effort-triggered breaths.

Stage 2:
- freeze selected neural drive;
- jointly fit muscle transmission and global stiffness to pre-transition VT and minute ventilation, with RR retained in the objective;
- muscle-transmission grid: 0.40, 0.55, 0.70, 0.85, 1.00, 1.20;
- stiffness grid: 0.5, 0.75, 1.0, 1.25, 1.5;
- no post-transition data used.

Results:

- finite patient-effort fit: 8/8
- objective <=0.5: 4/8
- objective <=1.0: 7/8
- median objective: 0.475
- maximum objective: 1.357
- nonzero modeled asynchrony in best fit: 1/8

Neural-drive selections:

- 0.10: 2
- 0.20: 4
- 0.35: 2
- no event required a higher tested drive value

Muscle-transmission selections:

- 0.40: 2
- 1.20: 6

Stiffness selections:

- 0.50: 3
- 0.75: 4
- 1.50: 1

Interpretation:

- respiratory timing is identifiable reasonably well from pre-transition RR using the continuous Hennigs drive axis;
- VT/MV fitting is less uniquely identifiable because muscle transmission and lung stiffness interact;
- 6/8 events hit the maximum implemented muscle-transmission envelope (1.2);
- those cases are therefore labeled high-transmission / boundary-constrained rather than assigned a precise muscle-transmission estimate;
- the supported envelope is not widened solely to improve retrospective fit;
- one event with nonzero modeled asynchrony should not be used as a clean dead-space validation case without further adjudication.

For the next dead-space validation step, the conservative PS subset is:
- objective <=1.0;
- patient-effort-triggered;
- no modeled asynchrony in the best fit.

This leaves 6 PS events with measured Grade A/B EtCO2 for the first simulator-vs-measured dead-space comparison.


## PS EtCO2 versus simulator dead-space validation

The six conservative PS cases with:
- Grade A/B EtCO2 pairing,
- effort-fit objective <=1.0,
- patient-effort-triggered breaths,
- no modeled asynchrony,

were used to compare measured PaCO2-PETCO2 gradient with the simulator dead-space fraction required to maintain pre-transition PaCO2.

Results:

- measured 0.091 -> simulator 0.10; PaCO2 error +0.005 mmHg
- measured 0.125 -> simulator 0.20; PaCO2 error -0.13 mmHg
- measured 0.098 -> simulator 0.80 upper boundary; PaCO2 error -1.28 mmHg
- measured 0.071 -> simulator 0.50; PaCO2 error +0.08 mmHg
- measured 0.030 -> simulator 0.05 lower boundary; PaCO2 error +2.54 mmHg
- measured 0.189 -> simulator 0.05 lower boundary; PaCO2 error +1.74 mmHg

Interpretation:

- simulator effective dead-space fraction is not a one-to-one transform of the measured PaCO2-PETCO2 gradient;
- the ordering is not consistently monotonic across these six patients;
- three of six best fits occur at the tested dead-space boundary;
- therefore no conversion equation is justified from these data;
- the measured PaCO2-PETCO2 gradient remains a separate measured phenotype feature;
- mismatch between measured gradient and simulator dead-space requirement is itself a useful model-diagnostic signal.

The next test is direct rather than fitted:
- set simulator dead-space fraction equal to the measured PaCO2-PETCO2 fraction;
- keep effort, mechanics, ventilator settings, and arterial gas initialization fixed;
- measure whether the model maintains baseline PaCO2.

This will test whether the measured gradient can be used directly as the model dead-space boundary without an empirical conversion.


## Direct use of measured PaCO2-PETCO2 fraction in PS

The six conservative PS cases with Grade A/B EtCO2 pairing were tested with the simulator dead-space fraction set directly equal to the measured:

`(PaCO2 - PETCO2) / PaCO2`

No dead-space fitting or conversion equation was used.

All other pre-transition phenotype components were fixed:
- fitted neural drive;
- fitted muscle transmission;
- fitted stiffness;
- documented PS/PEEP/FiO2;
- measured arterial gas initialization.

Twenty-second baseline-maintenance results:

- measured fraction 0.091 -> PaCO2 error -0.05 mmHg
- measured fraction 0.125 -> PaCO2 error -0.51 mmHg
- measured fraction 0.098 -> PaCO2 error -5.45 mmHg
- measured fraction 0.071 -> PaCO2 error -2.60 mmHg
- measured fraction 0.030 -> PaCO2 error +2.45 mmHg
- measured fraction 0.189 -> PaCO2 error +2.36 mmHg

Interpretation:

- direct use of the measured PaCO2-PETCO2 fraction is more defensible than deriving an empirical simulator conversion from this small cohort;
- five of six cases maintained baseline PaCO2 within approximately 3 mmHg;
- one event remains a clear model-mismatch outlier;
- Grade A/B measured PaCO2-PETCO2 fraction will therefore be the preferred dead-space boundary for phenotype initialization when available;
- when no high-quality EtCO2 pair exists, effective dead-space behavior remains latent/prior-constrained.

Important residual findings:

- PaO2 remained substantially underpredicted in all six cases;
- measured pH was also not preserved reliably because the current reduced gas core fixes SID rather than initializing patient-specific acid-base state.

Therefore the next major phenotype problem is oxygenation / shunt-VQ state, not further dead-space tuning.


## Composite oxygenating-perfusion phenotype boundary

The persistent PaO2 mismatch was traced to a non-patient-specific oxygenation boundary.

Before this change, patient-specific mechanics fitting changed stiffness/resistance but retained the synthetic reference perfusion distribution:

- normal compartment perfusionFraction: 0.55
- recruitable compartment perfusionFraction: 0.30
- consolidated compartment perfusionFraction: 0.15

The live reduced core then computed ventilated perfusion from those fixed fractions multiplied by current compartment recruitment, plus the HumMod basic right-to-left shunt of 220 mL/min.

In the six clean PS + EtCO2 validation cases:

- only 1/6 has any pre-index PEEP-response history;
- 0/6 has paired historical pre/post compliance.

Therefore recruitment state and regional perfusion maldistribution cannot be separately identified in this subgroup from a single baseline PaO2 value.

A research-only composite phenotype boundary has been added:

- `patientVentilatedPerfusionFractionOverride`

Interpretation:

- fraction of effective pulmonary perfusion participating in ventilated gas exchange in the reduced model;
- composite oxygenation state;
- does not claim to identify structural shunt, regional perfusion, or recruitment separately.

Behavior:

- when omitted, the original compartment perfusion x recruitment calculation is unchanged;
- when supplied, the composite fraction replaces only the calculated effective ventilated-perfusion fraction;
- HumMod basic right-to-left shunt and the downstream gas-exchange equations remain unchanged;
- snapshot records whether the patient-specific override was applied.

Validation:

- lower and higher ventilated-perfusion fractions were tested at fixed ventilation and identical arterial gas initialization;
- higher ventilated-perfusion fraction increased PaO2 in the expected direction;
- full live-session regression suite: 15/15 tests passed.

This composite parameter is appropriate only when the underlying recruitment/perfusion components are not separately identifiable. Pre-index perturbation history should be used to decompose the phenotype when sufficient data exist.


## Oxygenation fit in six clean PS + EtCO2 cases

The composite effective ventilated-perfusion fraction was fitted in the same six conservative PS cases after freezing:

- neural drive;
- muscle transmission;
- stiffness;
- measured PaCO2-PETCO2 dead-space fraction;
- documented ventilator settings;
- arterial gas initialization.

Fit target:
- pre-transition PaO2 only.

Cross-check:
- PaCO2 residual recorded separately.

Results:

- target PaO2 76 -> best effective ventilated-perfusion fraction 0.80; PaO2 error -3.13 mmHg; PaCO2 error -1.20 mmHg
- target PaO2 133 -> 0.95; PaO2 error +4.88 mmHg; PaCO2 error -1.27 mmHg
- target PaO2 154 -> 0.80; PaO2 error -2.12 mmHg; PaCO2 error -5.84 mmHg
- target PaO2 87 -> 0.80; PaO2 error -0.87 mmHg; PaCO2 error -3.29 mmHg
- target PaO2 85 -> 0.90; PaO2 error +6.10 mmHg; PaCO2 error +1.64 mmHg
- target PaO2 80 -> 0.80; PaO2 error -4.15 mmHg; PaCO2 error +2.06 mmHg

Interpretation:

- all six baseline oxygenation states were reproducible to within approximately 6 mmHg PaO2 using the composite oxygenating-perfusion parameter;
- fitted values ranged 0.80 to 0.95;
- none required the absolute upper bound of 1.0;
- the previously severe PaO2 underprediction was largely attributable to retaining the synthetic reference perfusion map;
- oxygenation fitting did not eliminate the known CO2 mismatch in one case, confirming that oxygenation and ventilation fit quality must remain separate.

Phenotype schema updated to v0.3.0:
- measured EtCO2 gradient added;
- measured dead-space initialization policy added;
- effective ventilated-perfusion fraction replaces the older fixed nonventilated-perfusion parameter;
- continuous Hennigs drive and muscle transmission are explicit assisted-mode phenotype axes;
- domain-specific mechanics, gas, effort, and oxygenation quality remain separate.


## Prediction-horizon correction after blinded pilot diagnostic

A six-event fully characterized PS + EtCO2 phenotype packet was frozen before outcome review.

Frozen phenotype fields included:
- controller state;
- neural drive;
- muscle transmission;
- mechanics stiffness;
- measured PaCO2-PETCO2 dead-space fraction;
- fitted effective ventilated-perfusion fraction;
- measured pre-transition arterial gas state;
- phenotype schema version and code commit.

One event was excluded from single-transition validation because a second material FiO2 change occurred before the post-ABG.

The remaining five events had post-ABG horizons of 84 to 142 minutes.

### Blinded long-horizon diagnostic

Intervention trajectories were simulated without access to post-transition outcomes.

After all predictions were written, outcomes were unsealed.

Finding:
- the absolute long-horizon model state drifted substantially from the fitted baseline;
- matched no-change trajectories showed similar drift;
- therefore the absolute 84-142 minute predictions cannot be interpreted as isolated intervention-response performance.

A drift-corrected exploratory prediction was then formed using only pre-transition state and paired model trajectories:

measured pre-state + [intervention model trajectory - no-change model trajectory]

This removed much of the intrinsic model drift but still failed to explain large clinical changes in several patients over 1-2 hours.

Interpretation:
- a frozen phenotype over 84-142 minutes is not a valid primary single-transition assumption;
- clinical state, perfusion, effort, metabolism, disease evolution, and non-ventilator care can change materially over this interval even without another material ventilator setting transition;
- the five-case long-horizon exercise is a design diagnostic only, not a final model-performance estimate.

### Numerical timestep benchmark

For research prediction runs, dt=0.010 s was compared with the canonical dt=0.002 s over 120 seconds in:
- one FiO2 transition;
- one PEEP transition.

PaO2, PaCO2, HR, MAP, RR, VT, and minute ventilation remained closely aligned, while the larger timestep materially reduced wall-clock time.

For the short-horizon retrospective pilot:
- prediction timestep: 0.010 s;
- simulations use 60-second chunks with trace compaction;
- canonical 0.002 s remains the reference implementation.

### Revised primary outcome horizon

The supported-mode cohort contains:

- post-ABG <=30 minutes: 65 transitions / 54 ICU stays
- <=45 minutes: 88 / 71
- <=60 minutes: 131 / 102
- <=90 minutes: 208 / 160
- <=120 minutes: 281 / 206
- <=180 minutes: 411 / 293

Primary validation is now restricted to post-ABG <=60 minutes.

Reason:
- this matches the existing +/-60 minute material competing-transition exclusion;
- the index ventilator change is therefore isolated throughout the primary outcome window;
- it reduces unmodeled phenotype evolution relative to the prior <=180 minute design.

Primary <=60 minute cohort:

- PC_AC PEEP: 4
- PC_AC FiO2: 18
- PC_AC set RR: 8
- PS PEEP: 43
- PS FiO2: 55
- VC_AC PEEP: 2
- VC_AC set VT: 1
- total: 131 transitions / 102 ICU stays

Sensitivity cohort:
- post-ABG <=30 minutes
- 65 transitions / 54 ICU stays

For the first FiO2/PEEP validation analysis, the <=60 minute cohort provides:
- 73 FiO2 transitions
- 49 PEEP transitions

RR/VT transitions remain exploratory because of smaller numbers.


## Primary <=60 minute phenotype fit readiness

A pre-transition-only fit manifest has been created for the 131-event primary validation cohort.

The manifest contains:
- anonymous stable event ID;
- intervention variable and pre/post setting values;
- pre-transition ventilator state;
- pre-transition arterial gas state;
- HR/MAP/SpO2;
- respiratory effort/mechanics observations;
- EtCO2 dead-space descriptor when available;
- identifiability and fit-status flags;
- pre-index PEEP-history availability;
- recorded inspiratory timing/flow needed for controlled modes.

Post-transition outcome values are not included in this manifest.

Readiness:

- total manifest: 131
- controller-ready: 130
- PS: 98/98 ready
- PC_AC: 29/30 ready
- VC_AC: 3/3 ready

The single non-ready PC_AC event lacks sufficient recorded inspiratory timing information and is excluded rather than assigned a guessed value.

Dead-space source plan:

- measured Grade A/B EtCO2: 1
- latent effective dead-space fit/prior: 130

Oxygenation source plan:

- pre-index PEEP history potentially available for decomposition: 43
- composite effective oxygenating-perfusion phenotype: 88

PS effort observability in the primary cohort:

- 2 effort observables: 2 events
- 3 observables: 15
- all 4 observables: 81

Controlled-mode mechanics availability:

- observed VT: 33/33
- peak pressure: 33/33
- plateau pressure: 20/33
- documented compliance: 25/33
- documented resistance: 24/33

The scalable fitting pipeline will therefore operate on 130 controller-ready events, with the 131st retained as a documented non-ready exclusion.


## Scaled PS effort fitting in the primary <=60 minute cohort

The generalized two-axis PS effort fitter was applied to all 98 controller-ready PS events in the primary <=60 minute cohort.

Fitting method:

Stage 1:
- fit Hennigs-supported neural drive to pre-transition respiratory rate;
- use total RR when available, otherwise spontaneous RR;
- drive grid: 0.10, 0.20, 0.35, 0.50, 0.70, 0.95;
- PS backup rate fixed at 2/min;
- reject candidates without predominantly patient-effort-triggered breaths.

Stage 2:
- freeze selected neural drive;
- jointly fit muscle transmission and global stiffness to the available pre-transition RR, observed VT, and minute ventilation;
- coarse grid first;
- refined grid only when coarse objective >0.5;
- dt=0.010 s, validated against the canonical 0.002 s timestep in prior FiO2 and PEEP benchmarks;
- no post-transition data used.

Results:

- completed: 98/98
- strong fit (objective <=0.5): 66
- acceptable (>0.5 to <=1.0): 21
- weak (>1.0): 11
- median objective: 0.349
- 90th percentile objective: 1.093
- maximum objective: 16.288
- refinement grid used: 44/98

Parameter-boundary diagnostics:

- muscle transmission at upper supported envelope 1.2: 43
- muscle transmission at lower tested value 0.4: 32
- neural drive at low grid boundary 0.10: 14
- neural drive at high tested value 0.95: 13
- stiffness at low grid boundary 0.50: 26
- stiffness at high grid boundary 1.50: 2

Modeled patient-ventilator interaction:

- zero modeled asynchrony: 47
- nonzero modeled asynchrony: 51

Structured MIMIC cannot verify dyssynchrony directly. Therefore modeled asynchrony is not interpreted as observed clinical dyssynchrony.

Conservative structured-data PS primary subset:

- strong or acceptable effort fit;
- zero modeled asynchrony.

Result:
- 41 PS events
- 33 strong
- 8 acceptable
- 24 FiO2 transitions
- 17 PEEP transitions

An additional 46 otherwise-good PS fits have nonzero model-inferred asynchrony. These remain available for sensitivity analysis and later waveform validation rather than being silently included in the structured-data primary analysis.

## Controlled-mode short-horizon mechanics coverage

The primary <=60 minute fit manifest contains 32 controller-ready PC_AC/VC_AC events.

Existing controlled mechanics fits cover all 32/32.

Fit quality:

- finite mechanics fit: 32/32
- objective <=0.5: 22
- objective <=1.0: 22
- weak (>1.0): 10

There are no borderline events between 0.5 and 1.0 in this short-horizon controlled subset.

The conservative mechanically representable controlled-mode primary subset is therefore 22 events.

## Current conservative prefit cohort before gas/oxygenation fitting

- PS with good effort fit and zero modeled asynchrony: 41
- PC_AC/VC_AC with mechanics objective <=1.0: 22
- total: 63 pre-transition mechanically/effort representable events

Gas-exchange and oxygenation phenotype quality must still be fitted and scored separately before the final frozen validation cohort is defined.


## CO2 phenotype identifiability and patient-specific metabolic boundary

The latent dead-space smoke test was repeated in five mixed-mode conservative primary events after mechanics/effort fitting.

Result:
- four finite fits selected the maximum tested dead-space fraction (0.80);
- one PC_AC case failed the gas-maintenance run;
- residual PaCO2 error remained substantial in several cases.

Interpretation:

A single pre-transition PaCO2 operating point cannot identify dead space independently because the reduced core also contains a fixed metabolic CO2-production boundary and a source-prior venous gas state.

The dead-space search range was **not** widened to improve retrospective fit.

### Longitudinal pre-index availability

Within the 63-event conservative mechanically/effort-representable cohort:

- events with >=2 arterial ABGs in the prior 6 hours: 50/63
- events with >=2 ABGs that also have nearby minute ventilation or documented RR+observed VT sufficient to characterize ventilation: 12/63
- events with >=3 such ABG/ventilation pairs: 3/63

By mode, events with >=2 paired pre-index observations:
- PS: 6/41
- PC_AC: 5/20
- VC_AC: 1/2

Therefore:
- 12 events are candidates for joint longitudinal identification of effective dead space and metabolic CO2 production;
- the remaining 51 events do not have enough structured pre-index information to separate those latent quantities reliably.

### Patient-specific metabolic CO2-production boundary

The live reduced HumMod core already has an explicit systemic metabolic CO2-production boundary. The reference value is inherited from the authored engineering boundary.

A research-only override has now been added:

- `patientTissueCo2ProductionMmolPerMin`

Behavior:
- when absent, the reference systemic gas boundary is unchanged;
- when supplied, only tissue CO2 production is replaced;
- downstream HumMod gas-exchange equations are unchanged;
- snapshot provenance records whether the override was applied.

Validation:
- at fixed ventilation, mechanics, dead space, and arterial gas initialization, higher patient-specific tissue CO2 production raises PaCO2 in the expected direction;
- full live-session regression suite: 16/16 tests passed.

Policy:
- do not fit dead space alone from a single PaCO2 point;
- where >=2 pre-index ABG/ventilation observations exist, dead space and tissue CO2 production may be jointly estimated;
- otherwise effective CO2-elimination phenotype remains partially identified/prior-constrained rather than assigned a falsely precise dead-space value.


## Joint longitudinal dead-space / CO2-production proof of concept

After requiring:
- at least two pre-index arterial ABGs;
- complete contemporaneous ventilation characterization;
- the same directly supported ventilator mode as the index event;

only 2 of the 63 conservative mechanically/effort-representable events remained:

- 1 PS
- 1 PC_AC
- 2 usable historical points each

A joint grid fit was tested for:
- effective dead-space fraction;
- patient-specific tissue CO2 production.

Results:

PS case:
- best dead-space fraction: 0.70
- best tissue CO2 production: lower search boundary
- standardized objective: 0.57
- PaCO2 residuals at the two historical points: approximately -3.2 and +4.3 mmHg

PC_AC case:
- best dead-space fraction: upper search boundary 0.80
- best tissue CO2 production: upper search boundary
- standardized objective: 0.14
- PaCO2 residuals: approximately -2.4 and -1.9 mmHg

Interpretation:

Even after adding a second pre-index operating point, dead space and metabolic CO2 production are not robustly separable in these two structured-data cases. Boundary hits remain common.

Phenotype policy is therefore:

1. If a high-quality paired EtCO2 measurement exists:
   - retain measured (PaCO2-PETCO2)/PaCO2 as the measured dead-space-related phenotype;
   - use it directly as the model dead-space initialization boundary for the current pilot.

2. If no high-quality EtCO2 pair exists:
   - do not estimate a precise patient dead-space fraction from PaCO2 alone;
   - label effective dead-space behavior as latent/prior-constrained;
   - retain uncertainty explicitly;
   - do not widen search envelopes solely to improve retrospective baseline fit.

3. Tissue CO2 production:
   - patient-specific runtime override is available and validated;
   - it is fitted only when independently identifiable from sufficient longitudinal pre-index data;
   - otherwise it remains prior-constrained.

This preserves the distinction between a physiologically measured dead-space descriptor and a model parameter that structured MIMIC cannot uniquely identify.


## Full PS + EtCO2 two-axis effort fitting

The two-axis effort fitter was run across all 8 PS events with Grade A/B EtCO2 pairing.

Research phenotype axes:

- neural drive: continuous Hennigs-supported relative drive
- muscle transmission: continuous transmission amplitude within implemented profile envelope
- lung stiffness: initially fitted jointly, then constrained by documented compliance where available

Initial 8-event joint fit results:

- objective <=0.10: 2/8
- <=0.50: 4/8
- <=1.00: 6/8
- <=1.50: 8/8
- median objective: 0.503

Best neural-drive values:

- 0.10 to 0.35 across the 8 events
- no event required a drive outside the Hennigs-supported envelope

Initial amplitude/stiffness identifiability:

- muscle-transmission low-grid edge: 3/8
- muscle-transmission high-grid edge: 5/8
- stiffness low-grid edge: 3/8
- one event showed nonzero asynchrony

Interpretation:

Neural timing is identifiable from pre-transition RR, but muscle-transmission amplitude and lung stiffness trade off substantially if fitted together.

### MIMIC Compliance validation

MIMIC item 229661 is labeled `Compliance`, but its metadata unit is `cmH2O/L/seconds`, which is dimensionally inconsistent with compliance.

Before using the field, it was compared against independently derived compliance from observed VT / (plateau - PEEP) in events where both were available.

Paired comparison:

- n = 22
- Pearson correlation = 0.958
- documented / derived compliance ratio:
  - median = 0.913
  - IQR approximately 0.85 to 1.05

Therefore item 229661 is treated as a compliance measurement for phenotype fitting, with the metadata-unit inconsistency explicitly documented.

### Compliance-to-stiffness mapping

For PS patients with documented compliance, model stiffness was mapped using a standardized passive pressure-controlled breath, independent of patient effort.

Documented compliance available in 6/8 EtCO2 PS events.

Closest model compliance results:

- 4/6 reproduced documented compliance within approximately 14%
- two very high-compliance cases were near the softest model boundary

### Compliance-constrained effort fitting

With neural drive fixed from RR and stiffness fixed from documented compliance, muscle transmission was refit.

Results:

- objective <=0.10: 2/6
- <=0.25: 3/6
- <=1.00: 4/6
- median objective: 0.60

Four cases were usable under the current model.

Two high-compliance cases failed the combined effort/mechanics consistency test:

- one produced only 1 ventilator breath for 3 efforts, RR ~5.7/min vs observed 15/min, objective ~17.6
- one produced 2 ventilator breaths for 3 efforts with excess VT/MV, objective ~5.1

These are rejected rather than forced into a fitted phenotype.

### PS acceptance-rule correction

The earlier patient-triggered check was one-sided and could accept multiple ineffective efforts.

The fitter now requires both:

- efforts >= 80% of ventilator breaths
- ventilator breaths >= 80% of efforts

This rejects substantial ineffective-effort or backup-breath mismatch.

Current interpretation:

- neural drive is well identified in most PS patients from pre-transition RR
- effort amplitude becomes interpretable only after mechanics are constrained
- extreme high-compliance cases expose a current model-boundary limitation and should be excluded from primary dead-space validation
- the next dead-space validation should use the PS cases that pass both compliance and effort-coupling checks


## PS EtCO2 dead-space validation after effort/mechanics fitting

Dead-space validation was repeated in the PS subgroup only after freezing patient-specific:

- neural drive
- muscle transmission
- compliance-constrained stiffness
- ventilator settings
- pre-transition arterial gas initialization

Eligibility required:

- compliance/effort objective <=1.0
- near one-to-one patient effort / ventilator breath coupling
- asynchrony index <=0.25

Accepted PS events: 4

Measured PaCO2-PETCO2 gradient vs best simulator dead-space fraction:

- 0.189 -> 0.05; PaCO2 residual +1.1 mmHg
- 0.300 -> 0.30; residual -0.2 mmHg
- 0.030 -> 0.05; residual +1.8 mmHg
- 0.091 -> 0.05; residual +1.5 mmHg

Interpretation:

- the largest measured gradient maps to the largest simulator dead-space setting;
- the very low measured gradient maps to the low simulator range;
- one moderate measured gradient (0.189) remains discordant with the simulator parameter;
- with n=4, no calibrated conversion is justified;
- measured PaCO2-PETCO2 gradient remains an independent phenotype constraint rather than a direct substitute for simulator dead-space fraction.

The next check is time-horizon stability of the inferred dead-space value, because the patient arterial initializer retains a HumMod venous gas prior. If the inferred dead-space setting changes materially between short maintenance windows, initialization dynamics rather than patient dead space may be driving the estimate.


## PS dead-space time-horizon stability

The four accepted PS dead-space validation cases were retested over 5-, 10-, and 20-second pre-transition maintenance windows.

Purpose:

- determine whether the inferred simulator dead-space fraction is stable;
- identify whether retained venous gas priors or short initialization transients materially drive the fit.

Results:

1. measured gradient 0.189
   - best simulator fraction: 0.05 at 5 s, 10 s, and 20 s
   - PaCO2 residuals remained approximately +0.9 to +1.1 mmHg

2. measured gradient 0.300
   - best simulator fraction: 0.40 at 5 s and 10 s
   - best simulator fraction: 0.30 at 20 s
   - PaCO2 residuals remained within approximately +/-0.2 mmHg

3. measured gradient 0.030
   - best simulator fraction: 0.05 at 5 s, 10 s, and 20 s

4. measured gradient 0.091
   - best simulator fraction: 0.05 at 5 s, 10 s, and 20 s

Interpretation:

- 3/4 cases are fully stable across the tested maintenance horizons;
- 1/4 shows only one grid-step variation;
- the discordant 0.189 measured-gradient case remains discordant across all horizons, so the discrepancy is not explained by short-horizon initialization alone;
- simulator dead-space fraction should be reported with uncertainty/range rather than as an exact measured physiologic quantity;
- measured PaCO2-PETCO2 gradient remains an independent phenotype descriptor and model-validation constraint.

This supports using the simulator dead-space parameter as a patient-specific latent gas-exchange parameter, but not equating it directly with the measured PaCO2-PETCO2 fraction.


## Oxygenation / recruitment phenotype development

Recruitability is now separated from baseline oxygenation impairment rather than represented by a single shunt parameter.

### Clean pre-index PEEP identification set

Historical PEEP perturbations were screened for:

- occurrence before the index transition;
- stable FiO2 across the historical step (<5 percentage-point change);
- stable ventilator mode;
- paired pre/post arterial gases.

Results:

- 224 historical PEEP perturbation rows before deduplication
- 34 with both stable FiO2 and stable mode
- 33 supported index events
- 31/34 also had paired SpO2
- all 34 had paired arterial PaO2

Mode distribution among the 34 clean historical perturbations:

- SPONT: 14
- CPAP/PSV: 13
- P-CMV: 6
- CMV/ASSIST/AutoFlow: 1

For controlled-mode recruitment development, the P-CMV subset was used first to avoid effort confounding.

### Controlled-history data-quality result

The 6 P-CMV rows represented 4 unique historical perturbations.

After applying the existing adult observed-VT plausibility range:

- 2 unique controlled historical perturbations remained suitable for mechanics fitting.

The first development event:

- PEEP 15 -> 10
- pre VT 187 mL
- post VT 135 mL
- pre PaO2 160 mmHg
- post PaO2 90 mmHg

### Recruitment-model limitation identified

The original recruitable compartment used synthetic engineering anchors:

- P_open = 22 cmH2O above AOP
- P_close = 12 cmH2O above AOP
- k_open = 0.02
- k_close = 0.05

Using the reference thresholds caused the live model to converge to a patient-independent recruitment state and prevented the measured pre-step oxygenation from being reproduced.

A single patient-specific pressure-threshold shift was therefore introduced in research fitting:

- P_open_patient = P_open_reference + threshold_shift
- P_close_patient = P_close_reference + threshold_shift
- hysteresis gap and kinetic rate constants remain unchanged

This is a research phenotype parameter only; the reference/default model remains unchanged.

### Phenotype decomposition

The oxygenation/recruitment phenotype is now represented by separate components:

1. normal ventilated perfusion burden;
2. fixed nonrecruitable/consolidated perfusion burden;
3. recruitable perfusion burden;
4. patient-specific recruitment pressure-threshold shift;
5. current recruitment state;
6. mechanics/stiffness.

This separation is required because baseline oxygenation and the oxygenation response to PEEP constrain different physiology.

### Threshold smoke test

At stiffness scale 2.0 and initial recruitable state 1.0:

- threshold shifts from -2 through -8 cmH2O kept the recruitable compartment open at PEEP 15;
- reference shift 0 caused substantial derecruitment before the historical PEEP intervention;
- positive shift +2 caused still greater derecruitment.

This demonstrated that a patient-specific threshold location is necessary for the historical event.

### First successful historical recruitment fit

A small grid separated fixed nonrecruitable perfusion from recruitable perfusion while holding:

- stiffness scale = 2.0
- recruitment threshold shift = -4 cmH2O
- initial recruitable state = 1.0

Best candidate:

- normal perfusion fraction: 0.70
- recruitable perfusion fraction: 0.15
- fixed consolidated perfusion fraction: 0.15

Observed versus modeled:

- pre PaO2: 160 vs 151.3 mmHg
- post PaO2: 90 vs 90.5 mmHg
- pre observed VT: 187 vs 199.5 mL
- post observed VT: 135 vs 131.4 mL

Model ventilated-perfusion fraction:

- pre: 0.85
- post: 0.722

This is the first pre-index historical perturbation in which the same patient-specific phenotype reproduces both the mechanical and oxygenation direction/magnitude of a PEEP change without using the index-transition outcome.

Interpretation:

- fixed shunt burden and recruitable shunt burden must be separate phenotype axes;
- recruitment pressure threshold must be patient-specific;
- recruitment kinetics remain fixed at the current reference values for now and are not claimed to be identified;
- the result is a development smoke test from one historical perturbation, not a calibrated population estimate.

No post-index data were used.


### Second controlled historical PEEP event: excluded from recruitment calibration

The second unique controlled P-CMV historical event had:

- PEEP 20 -> 18 cmH2O
- FiO2 0.40
- RR 10/min
- inspiratory pressure 10 cmH2O
- inspiratory time 3.0 s
- observed VT 150 -> 149 mL
- minute ventilation 1.50 -> 1.49 L/min
- PaO2 101 -> 99 mmHg
- PaCO2 43 -> 44 mmHg

The recorded pre-step plateau pressure was 17 cmH2O while PEEP was 20 cmH2O. That value is physiologically incompatible with the same breath/setting state and was excluded from fitting.

Mechanics-only fitting was strong:

- best stiffness scale approximately 2.0
- modeled VT approximately 153 -> 159 mL
- mechanics objective approximately 0.07

However, oxygenation could not be initialized correctly with recruitment/shunt parameters alone.

At the maximum tested ventilated-perfusion fraction:

- ventilated perfusion fraction = 1.00
- modeled PaO2 approximately 73 mmHg
- observed PaO2 = 101 mmHg
- modeled alveolar PO2 approximately 64 mmHg
- modeled end-capillary PO2 approximately 64 mmHg
- membrane gradient was small (~0.4 mmHg), arguing against membrane-diffusion limitation
- PaCO2 remained close to observed (~44 vs 43 mmHg)

Therefore the baseline failure is not explained by recruitable/fixed shunt burden. It reflects a gas-core limitation or an unmodeled patient-specific gas state in this very-low-VT phenotype.

Policy:

- this event is excluded from recruitment-parameter calibration;
- it can remain a model-mismatch case for later gas-core refinement;
- no recruitment threshold, recruitable perfusion, or fixed shunt estimate is accepted from this event.

Current controlled-history conclusion:

- 1/2 plausible controlled historical PEEP perturbations supports the recruitment phenotype structure;
- 1/2 is not baseline-identifiable and is excluded rather than forced.


## Spontaneous-mode historical recruitment development

The clean historical PEEP cohort contains 27 spontaneous-mode rows before deduplication:

- SPONT: 14 rows
- CPAP/PSV: 13 rows

After deduplication:

- SPONT: 13 unique historical perturbations
- CPAP/PSV: 12 unique historical perturbations

Pre-transition effort-data coverage:

- SPONT:
  - 12/13 have RR + VT + minute ventilation + pressure support
  - 7/13 also have documented compliance
- CPAP/PSV:
  - 7/12 have RR + VT + minute ventilation + pressure support
  - none of these have documented compliance

Therefore the first spontaneous recruitment-development subset is the 7 SPONT histories with both effort targets and compliance.

### Historical ABG timing

The broad historical screen allows relatively wide pre/post ABG windows. This is appropriate for candidate discovery but too loose for precise recruitment-parameter calibration.

Among the 7 SPONT + compliance histories, ABG timing relative to the PEEP transition was:

- 42 min pre / 158 min post
- 97 / 143
- 24 / 52
- 100 / 233
- 63 / 78
- 74 / 109
- 30 / 81

The 97/143-minute PEEP 5->8 event was initially tested but is now excluded from primary recruitment calibration because the pre-ABG is too remote from the transition to represent an exact baseline state.

For primary recruitment development, tighter historical gas timing is required. The best available SPONT case has pre/post ABGs 24 and 52 minutes from the intervention.

### First tighter SPONT recruitment case

Event characteristics:

- mode: SPONT / pressure support
- PEEP: 10 -> 8 cmH2O
- pressure support: 8 cmH2O
- pre/post ABG timing: 24 min before / 52 min after
- observed RR: 27/min
- observed VT: 480 mL
- observed minute ventilation: 12.7 L/min
- documented compliance: 56.1 mL/cmH2O
- PaO2: 114 -> 113 mmHg
- post VT: 537 mL
- post minute ventilation: 13.5 L/min

Pre-step effort/mechanics fit:

- stiffness scale: 0.75
- modeled compliance: 52.3 mL/cmH2O
- neural drive: 0.45
- muscle transmission: 1.0
- modeled RR: 24.3/min
- modeled VT: 505 mL
- modeled MV: 12.3 L/min
- effort objective: 0.39
- effort/breath coupling: 1:1
- no asynchrony

The mechanics response to PEEP 10 -> 8 was also reproduced well:

- modeled post VT approximately 536 mL
- observed post VT 537 mL
- modeled post MV approximately 13.0 L/min
- observed post MV 13.5 L/min

### Low-recruitability oxygenation fit

The initial oxygenation grid forced at least 5% fixed plus 5% recruitable perfusion and therefore could not exceed a ventilated-perfusion fraction of 0.90. That artificially underpredicted the measured PaO2.

A near-zero abnormal-perfusion refinement was therefore run.

Best region:

- total non-normal perfusion burden approximately 0.05
- pre modeled PaO2 approximately 114 mmHg
- post modeled PaO2 approximately 109 mmHg
- observed 114 -> 113 mmHg

Several decompositions were nearly equivalent:

- recruitable 0.025 + fixed 0.025
- recruitable 0.00 + fixed 0.05
- recruitable 0.05 + fixed 0.00

These solutions had nearly identical objective values.

Interpretation:

- this event supports a low total abnormal-perfusion / low-recruitability phenotype;
- it does not separately identify fixed versus recruitable perfusion burden because the observed PEEP change produced essentially no oxygenation response;
- fixed and recruitable shunt components must therefore remain partially identified in this event rather than assigned a precise split;
- the controlled PEEP 15 -> 10 event remains the stronger example for separating fixed from recruitable burden because it contains a large oxygenation response.

No post-index data were used.


### Additional SPONT historical case excluded

The second tighter-timing SPONT candidate had:

- PEEP 10 -> 8 cmH2O
- pre/post ABG timing approximately 30 / 81 minutes
- PaO2 58 -> 73 mmHg

This apparent improvement in oxygenation after PEEP reduction could reflect overdistension/perfusion redistribution or other time-varying physiology. However, the pre-step effort phenotype was not adequately identified:

- RR target 20/min; modeled ~20.7/min
- VT target 381 mL; modeled ~538 mL
- MV target 9.3 L/min; modeled ~11.1 L/min
- effort objective ~2.09
- mild ineffective-effort mismatch

Therefore this event is excluded from recruitment calibration. No overdistension or inverse-PEEP-response phenotype is inferred from it.

Current recruitment-calibration policy:

- historical PEEP response is used only when pre-step effort/mechanics and baseline oxygenation are adequately identified;
- wide ABG timing windows are exploratory only;
- discordant events are retained as model-mismatch cases rather than forcing additional phenotype parameters.


## Pre-transition phenotype packet

A frozen pre-index phenotype packet is now generated for all 411 directly supported events.

Local output:

`/Users/philipbernard/mimic-data/derived/pretransition_phenotype_packet.parquet`

Patient-level packet rows remain local and are not committed.

Aggregate results:

- total supported events: 411
- pre-transition fit-ready: 351
- mode counts:
  - PS 333
  - PC_AC 70
  - VC_AC 8

Mechanics identifiability:

- A: 159
- B: 16
- C: 236

PS effort identifiability:

- A: 112
- B: 161
- C: 60

Dead-space identifiability:

- A: 4
- B: 7
- C: 400

Recruitment identifiability:

- B: 6
- C: 405

The packet explicitly distinguishes observed measurements, fit-ready latent parameters, historically constrained parameters, and prior-only states.

The previous empty `fitted_*` placeholder columns are not interpreted as fitted physiology.

Full field definitions and grading rules are documented in `research/mimic/PHENOTYPE_PACKET.md`.


## Blinded primary prediction set

Primary validation inputs and held-out truth are now physically separated.

Primary scope:

- interventions: FiO2 and PEEP
- modes: PS, PC_AC, VC_AC
- requires pretransition_fit_ready

Local outputs:

- blinded_primary_prediction_inputs.parquet
- blinded_primary_prediction_truth.parquet

Counts:

- total: 330
- FiO2: 196
- PEEP: 134
- PS: 272
- PC_AC: 51
- VC_AC: 7
- complete held-out post ABG: 330/330

Leakage protection:

- build script asserts that no post-transition field exists in the blinded input schema;
- current leakage check passes;
- fitter/simulator code must not read the truth file.

Full contract: research/mimic/BLINDED_VALIDATION.md


## First end-to-end blinded controlled prediction smoke test

The blinded controlled-mode pipeline was completed for one VC_AC PEEP event with a post-intervention ABG 2 minutes after the ventilator change.

### Controller-state completeness

The blinded prediction export now includes the full pre-transition controlled-mode controller state:

- PC_AC:
  - inspiratory time
- VC_AC:
  - inspiratory flow
- both:
  - mode-specific RR / VT / Pinsp / PEEP / FiO2

Current controller-state coverage in the blinded primary cohort:

- PC_AC with inspiratory time: 50/51
- VC_AC with inspiratory flow: 7/7

The single PC_AC event without timing is not part of the high-quality controlled mechanics-fit subset.

### Controlled mechanics-fit-ready primary subset

Within the blinded FiO2/PEEP primary cohort:

- controlled-mode events: 58
- matched to controlled mechanics fit: 57
- finite mechanics fit: 56
- mechanics objective <=1.0: 48
  - PC_AC: 41
  - VC_AC: 7

Interventions among these 48:

- FiO2: 35
- PEEP: 13

### Baseline gas-state stabilization

A first truth-blind forward run showed that a good mechanics fit is not sufficient: the gas state can drift substantially even with no ventilator intervention.

A pre-transition gas fitter was therefore added.

Patient-specific effective gas phenotype parameters:

1. effective dead-space fraction
2. ventilated-perfusion fraction
3. metabolic CO2 production

These are fit only to pre-transition physiology and then frozen before intervention.

For the first time-matched VC_AC test event:

- observed baseline PaO2: 116 mmHg
- observed baseline PaCO2: 50 mmHg
- observed baseline pH: 7.30

Best pre-only gas fit:

- effective dead-space fraction: 0.70
- ventilated-perfusion fraction: 1.0
- metabolic CO2 production: 6 mmol/min

120-second no-intervention stability:

- PaO2: 115.2 mmHg
- PaCO2: 49.1 mmHg
- pH: 7.331

These are effective latent model parameters. The dead-space value is not claimed to equal measured physiologic VD/VT unless separately constrained by EtCO2.

### Blinded 2-minute prediction

Intervention:

- mode: VC_AC
- PEEP 10 -> 8 cmH2O

The model generated and wrote the 120-second prediction before the truth file was opened.

Predicted:

- PaO2: 115.9 mmHg
- PaCO2: 49.0 mmHg
- pH: 7.331

Held-out observed ABG at 2 minutes:

- PaO2: 121 mmHg
- PaCO2: 46 mmHg
- pH: 7.33

Prediction error:

- PaO2: -5.1 mmHg
- PaCO2: +3.0 mmHg
- pH: +0.0015

This is a single technical smoke test, not a study result.

### Outcome-time issue

The first attempted controlled event had its next ABG 103 minutes after the intervention, making a 20-second model prediction non-comparable.

Outcome timing in the 330-event primary cohort:

- <=15 min: 19
- <=30 min: 52
- <=60 min: 106
- <=90 min: 170
- <=120 min: 227
- <=180 min: 330

Among the 48 controlled mechanics-fit-ready events:

- <=15 min: 3
- <=30 min: 11
- <=60 min: 19
- <=90 min: 30

Prediction horizon must therefore be explicitly matched or stratified before cohort-scale scoring.


### Second blinded controlled event

Independent blinded test:

- event: FIT-f469668e9be5
- mode: PC_AC
- intervention: FiO2 0.50 -> 0.40
- held-out ABG timing: 1 minute
- mechanics objective: 0.147

Pre-transition baseline:

- PaO2 84 mmHg
- PaCO2 46 mmHg
- pH 7.44

The baseline gas fitter was made horizon-aware and run at the 60-second evaluation horizon.

Pre-only fitted effective gas parameters:

- effective dead-space fraction: 0.10
- ventilated-perfusion fraction: 0.85
- tissue CO2 production: 4 mmol/min

60-second pre-transition stability:

- PaO2 78.4 mmHg
- PaCO2 47.2 mmHg
- pH 7.348

Baseline QC was accepted for PaO2/PaCO2 development purposes; pH remains diagnostic because SID is fixed in the reduced core.

Frozen 60-second prediction:

- PaO2 62.8 mmHg
- PaCO2 47.2 mmHg
- pH 7.348

Held-out observed 1-minute ABG:

- PaO2 84 mmHg
- PaCO2 46 mmHg
- pH 7.47

Errors:

- PaO2: -21.2 mmHg
- PaCO2: +1.2 mmHg
- pH: -0.122

Interpretation:

- CO2 prediction was close;
- oxygenation response was substantially overpredicted;
- the event is recorded as a blinded oxygenation-response miss;
- no phenotype parameter is retuned from this post-transition result;
- the next independent short-horizon FiO2 event is used to test whether this is event-specific or systematic.

The PC_AC mechanical warm-up is now mode/rate dependent so multiple complete breaths occur before gas-core initialization.


## Primary-60 pre-transition oxygenation smoke screen

After the second blinded FiO2-response miss, a pre-transition-only oxygenation screen was started before additional outcome scoring.

Purpose:

- test whether the reduced core can reproduce baseline PaO2 across the short-horizon cohort using a patient-specific ventilated-perfusion fraction;
- do not use post-transition outcome values;
- keep prefit mechanics / PS effort state frozen.

First 3 events:

1. FIT-05c54056e1c9, PS
   - best ventilated-perfusion fraction: 0.60
   - PaO2 residual: -1.35 mmHg
   - PaCO2 residual: -14.85 mmHg
   - oxygenation-search boundary hit: no

2. FIT-0a7a90b63a74, PS
   - best ventilated-perfusion fraction: 0.80
   - PaO2 residual: -5.25 mmHg
   - PaCO2 residual: -7.72 mmHg
   - oxygenation-search boundary hit: no

3. FIT-102b833418f3, PS
   - best ventilated-perfusion fraction: 0.90
   - PaO2 residual: +6.15 mmHg
   - PaCO2 residual: -7.50 mmHg
   - oxygenation-search boundary hit: no

Interpretation:

- baseline oxygenation can be represented reasonably in these first three events without forcing the search to a boundary;
- the previous blinded FiO2-response miss is therefore not explained simply by inability to match baseline PaO2;
- PaCO2 remains unstable when only oxygenation is fitted, so full baseline gas fitting still requires dead-space / CO2-load constraints;
- no post-transition truth was read for this screen.
