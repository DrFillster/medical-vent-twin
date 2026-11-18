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
