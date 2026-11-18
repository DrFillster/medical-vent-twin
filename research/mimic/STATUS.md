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
