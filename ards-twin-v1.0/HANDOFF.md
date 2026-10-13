# HumMod / Vent v1.6 Handoff

Date: 2026-10-11
Active product branch: `v1.6`
Active physiology/reference branch: `DrFillster/hummod-vent-core:main`

## Governing product definition

The product is a **digital twin of one persistent patient**.

The physician-facing application is not a scoreboard showing whether HumMod,
Ursino, Albanese, CircAdapt, Shimayoshi, or another model is "right." Those models
are development inputs.

The physician should see **one evolving canonical patient state**.

### Ownership rule

Every canonical physiologic variable has one active owner.

Examples:
- Vent owns high-resolution ventilator/lung mechanics.
- A selected pulmonary vascular model may own PAP/PVR/RV afterload.
- A selected cardiovascular plant may own SV/CO/MAP and chamber state.
- A selected autonomic/chronotropic controller may own HR.
- A selected myocardial energetic model may own intracellular energetic/contractile state.

Competing models may run in research/shadow mode during model selection, but:
- they are not co-equal bedside outputs;
- they are not averaged together;
- they are not tuned to agree with HumMod.

**Agreement with HumMod is not required.**
**Agreement between competing models is not required.**

The decisive criterion is whether the integrated patient reproduces defensible
human/experimental physiology.

Canonical architecture documents:
- `ards-twin-v1.0/docs/DIGITAL_TWIN_GOVERNING_PRINCIPLES.md`
- `ards-twin-v1.0/docs/PHYSICIAN_PHYSIOLOGY_ACCEPTANCE_GATE.md`
- `hummod-vent-core/docs/REFERENCE_MODEL_LEDGER.md`

## Equation/provenance rule

For every physiologically meaningful active relationship preserve:
- primary source;
- exact equation/table/page or source-code location;
- units;
- parameter values and provenance;
- intended effect;
- model operating range;
- canonical-state inputs and outputs;
- cross-model coordinate transforms;
- validation evidence;
- authority state.

If an equation, parameter, or adapter is not source-complete:
- fail closed;
- keep research-only;
- do not fill the gap with a guessed gain.

No parameter may be introduced solely to make the patient response look clinically familiar.

## Current physician objective

The next physician-review candidate should present **one patient**, with primary
bedside variables:

- HR
- MAP
- CO
- SV
- SVR
- PVR
- CVP/RAP
- PAP
- SpO2/SaO2
- PaO2
- PaCO2
- pH
- SvO2/PvO2 where source-valid
- ventilator settings
- PEEP
- peak pressure
- plateau pressure
- total PEEP
- driving pressure
- VT
- RR
- compliance

Research/model-internal variables remain diagnostic-only.

The central validation question is:

> If the patient becomes progressively hypoxic, hypercapnic and acidotic, does the
> entire cardiopulmonary trajectory look like a critically ill human, and can the
> important responses be traced to published mechanisms?

## What Vent owns

Vent remains authoritative for:
- ventilator controller and mode;
- airway pressure/flow/volume waveforms;
- high-resolution breath mechanics;
- PEEP;
- resistance/compliance;
- recruitment/derecruitment;
- plateau/total PEEP/driving pressure;
- breath holds;
- bedside respiratory mechanics.

Do not replace Vent mechanics with a lower-resolution whole-body respiratory model.

## Major work completed this session

### 1. Reference architecture restored

`hummod-vent-core`:
- `docs/REFERENCE_MODEL_LEDGER.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`

The architecture now explicitly defines HumMod as a reference/source/comparator/
subsystem donor, not automatic whole-body authority.

Relevant commits included:
- `63f89cfe1d476c2c07fbb0c77e9838555c85abed` — reference-model ledger
- `7a2faa88501dc5aaa566dc6bdc297224fd959065` — modular architecture
- `4a88ea33d877e221b8279a0682e8437add55ce90` — evidence-driven roadmap
- `b39a0268a1b43e46a97b9ff9178d60219c4975a0` — reference ledger updated with pulmonary/HR candidates

The previous “Jennings” reference was a typo and is no longer a blocker.

### 2. Physician UI cleanup

The v1.5 physician monitor was changed to emphasize bedside variables:
- HR
- MAP
- CO
- SV
- SVR
- PVR
- CVP/RAP
- PAP
- SaO2
- PaO2
- PaCO2
- pH
- SvO2/PvO2
- ventilator variables

Research signals were moved out of the default physician view.

Important physician feedback:
- the previous screen had many physiologically incoherent trajectories;
- initialization drift is **not a development priority**;
- integrated physiology is the priority.

### 3. Pulmonary vascular candidate added

Primary source:
Karamolegkos N, Albanese A, Chbat NW.
**Heart-Lung Interactions During Mechanical Ventilation: Analysis via a
Cardiopulmonary Simulation Model.**
IEEE Open J Eng Med Biol. 2021;2:324-341.
DOI: 10.1109/OJEMB.2021.3128629. PMCID: PMC8975239.

Files:
- `docs/PULMONARY_VASCULAR_CANDIDATE_EQUATION_LEDGER.md`
- `src/karamolegkos_pulmonary_circulation_candidate.js`
- `test/v15_karamolegkos_pulmonary_circulation_candidate.test.js`

Source equations preserved include pulmonary artery, arteriole, capillary, venous
continuity/momentum equations and lung-volume-dependent pulmonary peripheral
resistance:

```
R_pal(V_A, sh)
  = R_pp,tot / [2 * (1 - sh)] * (V_A / FRC_nom)^2
```

Source human reference parameters are preserved.

Status:
- candidate only;
- not canonical PAP/PVR owner yet.

Hard integration boundary:
Vent's current elastic volume is **not yet source-proven to be the same absolute
alveolar-volume coordinate `V_A`** used by Karamolegkos.

Explicit audit:
- `docs/VENT_TO_PULMONARY_VASCULAR_COORDINATE_AUDIT.md`

Do not use the convenience mapping:
`V_A = FRC + Vent.totalVolume`
without a sourced coordinate transform.

### 4. Regional V/Q / HPV audit

Marquis AD, Jezek F, Pinsky DJ, Beard DA.
**Hypoxic pulmonary vasoconstriction as a regulator of alveolar-capillary oxygen
flux: A computational model of ventilation-perfusion matching.**
PLoS Comput Biol. 2021;17:e1008861.
DOI: 10.1371/journal.pcbi.1008861.

Public code reviewed:
- `beards-lab/VQmodel`
- reviewed tree revision: `59416ed8f777a82df29c4b5707150cd58d9b4b32`

Source HPV relationship includes:
```
S_i = exp(-P_alv,O2,i / P_HPV)
```

with first-order vascular regulation and resistance/compliance modulation.

Status:
- useful mechanistic reference;
- **not authorized as human HPV physiology** because it is a rat-lung model and
  contains fitted/engineering parameters.

### 5. Source-complete heart-period candidate added

Primary source:
Iwamoto M, Hirabayashi S, Atsumi N.
**In-silico simultaneous respiratory and circulatory measurement during voluntary
breathing, exercise, and mental stress: A computational approach.**
PLoS Comput Biol. 2024;20:e1012645.
DOI: 10.1371/journal.pcbi.1012645.
PMID: 39689064.

Files:
- `docs/CHRONOTROPY_CANDIDATE_EQUATION_LEDGER.md`
- `src/ursino_iwamoto_heart_period_candidate.js`
- `test/v15_chronotropy_candidate.test.js`

Source heart-period equations preserve:
- sympathetic threshold;
- sympathetic/vagal gains;
- delays;
- time constants;
- baseline period;
- reciprocal HR relation.

### 6. Magosso/Ursino O2-CO2 autonomic candidate added

Primary source:
Magosso E, Ursino M.
**A mathematical model of CO2 effect on cardiovascular regulation.**
Am J Physiol Heart Circ Physiol. 2001;281:H2036-H2052.
DOI: 10.1152/ajpheart.2001.281.5.H2036.

Files:
- `docs/MAGOSSO_URSINO_2001_CO2_CANDIDATE_LEDGER.md`
- `src/magosso_ursino_2001_gas_autonomic_candidate.js`
- `test/v15_magosso_ursino_2001_gas_autonomic_candidate.test.js`

The primary Eq. 1 O2-CO2 chemoreceptor transcription was recovered and preserved
including its unusual piecewise branch behavior near PaO2=40 mmHg. It is not
smoothed or “corrected.”

Candidate outputs include:
- f_ac
- theta_sp
- theta_sv
- theta_sh
- f_sp
- f_sv
- f_sh

### 7. Composite single-HR candidate built

Files:
- `docs/CANONICAL_HR_CANDIDATE_LEDGER.md`
- `src/canonical_hr_candidate.js`
- `test/v15_canonical_hr_candidate.test.js`
- `scripts/canonical-hr-candidate-challenge.js`

Source chain:
```
arterial pressure
 -> Ursino baroreceptor f_ab

PaO2 + PaCO2
 -> Magosso/Ursino peripheral chemoreceptor f_ac
 -> CNS O2/CO2 offsets

actual Vent VT
 -> pulmonary stretch f_ap

f_ab + f_ac + f_ap + CNS offsets
 -> f_sh / f_sp / f_sv

f_ab + f_ac + f_ap
 -> cardiac vagal f_v

f_sh + f_v
 -> Iwamoto/Ursino heart period
 -> candidate HR
```

This controller does not require HumMod inputs.

### 8. External human validation ledger added

`hummod-vent-core/docs/CANONICAL_HR_EXTERNAL_VALIDATION_LEDGER.md`

Important human validation datasets preserved:

Halliwill et al. 2003:
- isocapnic hypoxia;
- SaO2 ~85%;
- HR 61.9 -> 74.7/min;
- MAP 97.4 -> 103.9 mmHg;
- sympathetic activity increased.

Houssiere et al. 2005:
- SaO2 ~97% -> 84%;
- HR 64 -> 83/min;
- MAP 83 -> 86 mmHg;
- MSNA increased substantially.

Simmons et al. 2007:
- mild hyperoxic hypercapnia, +5 mmHg ETCO2;
- HR 59.3 -> 62.4/min;
- MAP essentially unchanged;
- no major MSNA increase.

These are validation targets, **not calibration constants**.

## Important model-selection result

The stitched canonical HR candidate is **not ready for authority**.

Its challenge run showed:
- baseline HR approximately mid-50s;
- PaO2 50 mmHg produced only a small HR increase, approximately high-50s;
- this is too weak relative to preserved healthy-human isocapnic-hypoxia data;
- in severe combined respiratory failure, sympathetic outputs approached ceiling
  while HR later fell as vagal drive rose.

Interpretation:
- this is a model-selection result;
- do **not** tune an empirical HR gain;
- do **not** tune toward HumMod;
- keep the candidate as limited/rejected unless a source-level reason for the
  mismatch is identified.

## New direction: integrated cardiopulmonary candidate

A more promising next candidate has been located:

Repository:
`DavidRConnell/An-integrated-mathematical-model-of-the-human-cardiopulmonary-system`

Source code:
- `integratedModel.m`
- source revision currently reviewed: `7a7e54dd0acab14d57d7a5d4a6940871546137a7`

This implements the Albanese/Cheng/Ursino/Chbat integrated cardiopulmonary model
and includes:
- systemic vasculature;
- pulmonary circulation;
- LV/RV mechanics;
- baroreflex;
- sympathetic and parasympathetic control;
- LV/RV Emax effectors;
- systemic resistance effectors;
- venous unstressed-volume effectors;
- heart-period effectors;
- lung mechanics;
- gas exchange;
- respiratory control.

Important source-code parameters already identified:
- carotid baroreceptor Pn=92 mmHg;
- fmin=2.52 spikes/s;
- fmax=47.78 spikes/s;
- sympathetic threshold=2.66 spikes/s;
- LV Emax gain=0.475;
- RV Emax gain=0.282;
- splanchnic/extrasplanchnic resistance gains;
- venous unstressed-volume gains;
- sympathetic heart-period gain=-0.13;
- vagal heart-period gain=0.09;
- delays/time constants;
- baseline heart period `hr.Tbasal=0.833 s`;
- pulmonary/systemic vascular parameters;
- ventricular parameters.

The source code also directly implements the Ursino cardiovascular equations
and effectors as one coupled plant.

### Why this is now the preferred next cardiovascular/control candidate

The previous HR candidate stitched several valid source modules together but did
not reproduce the desired external human chronotropic response strongly enough.

The integrated Albanese/Cheng/Ursino/Chbat model lets us evaluate:
- HR
- MAP
- SV
- CO
- vascular resistance
- venous capacitance
- ventricular elastance

as one coupled source-family candidate rather than manually composing isolated
effectors.

This is closer to the digital-twin design.

## Immediate next work

1. Pin the integrated model repository/revision in the reference ledger.
2. Transcribe the **cardiovascular plant + controller equations** from
   `integratedModel.m` and the primary Albanese/Ursino papers.
3. Preserve all parameters with units and source locations.
4. Port the cardiovascular/control subset equation-for-equation into a candidate
   JS module.
5. Reproduce source baseline and perturbation behavior.
6. Run external validation against human hypoxia/hypercapnia data.
7. If credible, connect Vent mechanics/gases into this candidate through explicit
   canonical interfaces.
8. Only after validation, consider making this integrated candidate the owner of
   HR/MAP/CO/SV/SVR-related state.

Do not spend time trying to make the earlier stitched HR candidate agree with
HumMod.

## Myocardial energetics direction remains unchanged

Preferred cellular path:
- Crampin & Smith 2006 intracellular-acidosis excitation-contraction coupling;
- Shimayoshi / Takeuchi / Matsuoka 2026 intracellular O2, mitochondrial energetics,
  ATP/PCr, intracellular pH, Ca handling, cross-bridge stress.

Required chain:
```
coronary flow + CaO2
 -> myocardial O2 availability
 -> intracellular energetic state
 -> Ca/cross-bridge force
 -> source-valid chamber mechanics
 -> SV / CO / MAP
```

Do not use:
- direct arterial PaO2 -> contractility scalar;
- direct arterial pH -> Emax scalar;
- arbitrary oxygen-debt -> Emax scalar as final physiology.

## Native HumMod role

Pinned HumMod comparison source:
- repository: `riliescu/hummod-standalone`
- revision: `8dab57e05631f779bf5020fe0dd51874d8ae98c1`
- HumMod.EXE SHA-256:
  `4243E8721F77A5FABF3128FAC5AC139588B20A8285D35D2021C6852D596803CB`

HumMod remains useful for:
- source reproduction;
- reference trajectories;
- selected subsystem experiments;
- comparison context.

It is not the architectural destination or validation standard.

## GitHub Actions policy

Use Actions sparingly.

A lightweight v1.5 physician-evaluation gate exists and:
- skips Mac/Wine qualification on hosted Linux;
- runs build;
- runs unit/regression tests;
- verifies deployable web;
- records candidate physiology audits.

Latest successful gate observed during this session:
- workflow run `38185567787`
- source SHA `b39dd86532e43e12362855f876a7824def03ac4b`
- conclusion: **success**

Do not repeatedly trigger Actions for documentation-only work.

## Fidelity constraints

- No guessed physiologic gains.
- No direct tuning to desired bedside numbers.
- No averaging competing models.
- No requirement to agree with HumMod.
- No subsystem authority without primary equations/parameters and external validation.
- Stable prior versions remain recoverable.
- The physician sees one digital patient, not multiple model outputs.


## 2026-10-12 physiology registry checkpoint

Physician approved creation of an exact machine-readable census of model equations and variables.

Implemented on v1.5:
- `docs/physiology-registry.json` — initial machine-readable registry seed.
- `scripts/summarize-physiology-registry.js` — deterministic counts by authority, provenance, and subsystem.
- `test/v15_physiology_registry.test.js` — verifies the registry is readable/nonempty and that exact totals fail closed while backfill is incomplete.
- package scripts: `physiology:registry` and `physiology:registry:exact`.

Critical rule:
- registry completeness is currently `PARTIAL_BACKFILL` and `exactTotalsAllowed=false`;
- do not publish an exact model-wide equation/variable total until every physiology source module is classified and completeness is explicitly promoted to `COMPLETE`;
- unclassified relationships must remain visible as unclassified, never inferred or silently assigned;
- the registry must preserve provenance class and authority state (canonical/live, candidate, shadow, diagnostic-only, legacy inactive).

Commits:
- `02847a8def00b01d4e37958f802bfcddb9c4c0e7` — registry seed.
- `019d88cace9ef5ef18f684513a0ff1b549db68c8` — fail-closed summarizer.
- `b1b76fa4e09800cfb48bf1609c3b140338c5e9ab` — registry gate test.
- `3bbbcd4aff27366fbefda322c9430288c1eb0253` — package commands.

No physiology equations, gains, or authority assignments were changed by this work.


## 2026-10-12/13 v1.6 cardiopulmonary-candidate checkpoint

### Branch point

v1.6 starts exactly from v1.5 commit:
- `b0425e60e7e0fa21fe969966dd3e5b2976dbd583`

No v1.5 history was rewritten.

### Primary v1.6 objective

Build one integrated cardiopulmonary candidate patient rather than continue
isolated HR or reduced-systemic patches.

Current candidate spine inherited from v1.5:
- Vent remains owner of ventilator/airway mechanics.
- PaO2 + PaCO2 + delivered VT feed the source-family autonomic chain.
- Ursino/Magosso five-bed cardiovascular plant owns candidate systemic
  hemodynamics.
- local O2 regulation is present for brain, skeletal muscle, and coronary beds.
- Karamolegkos pressure/absolute-alveolar-volume coupling remains fail-closed
  until the Vent coordinate bridge is source-verified.
- no guessed physiologic gains are authorized.

### Myocardial pHi integration state

The manual myocardial intracellular-pH coordinate is no longer the intended
architecture. The HumMod 2012/2013 myocardial acid-base runtime is already
source-transcribed and derives myocardial pHi internally from its upstream
states.

Nine upstream states are required to eliminate externally supplied myocardial pHi.

Already live-accessible:
1. blood SID
2. arterial HCO3-

Source-transcribed but not yet live-coupled:
3. intracellular K
4. LV liquid volume
5. myocardial blood flow
6. myocardial O2 use
7. anaerobic glucose use
8. myocardial lactate use
9. systemic lactate-pool concentration

Relevant source modules already present:
- `src/hummod_2013_kcell_provider.js`
- `src/hummod_2013_left_heart_liquid_volume_provider.js`
- `src/hummod_2013_left_heart_flow_candidate.js`
- `src/hummod_2013_left_heart_metabolism_provider.js`
- `src/hummod_2013_left_heart_fuel.js`
- `src/hummod_2013_left_heart_lactate.js`
- `src/hummod_2013_lactate_pool_provider.js`
- `src/hummod_2013_myocardial_acid_base_runtime.js`
- `src/hummod_2013_derived_phi_compensation_decompensation_candidate.js`

Target live chain:

```
cardiopulmonary hemodynamics + blood chemistry
 -> source myocardial flow / O2 use
 -> source fuel and lactate state
 -> myocardial CO2/SID/pHi
 -> source pHi contractility pathway
 -> candidate chamber mechanics
```

Do not substitute arterial pH for myocardial pHi.
Do not use a direct PaO2-to-Emax or arterial-pH-to-Emax scalar.

### Save discipline

For v1.6:
- update HANDOFF.md after each meaningful positive or negative integration test;
- preserve rejected approaches and blockers;
- do not change source equations merely to make the trajectory look familiar;
- when a result is source-consistent and clinically close enough that normal
  interpatient variability could explain the remainder, ask the physician
  before modifying physiology.


### v1.6 checkpoint — persistent myocardial pHi provider foundation

Implemented:
- `src/hummod_2013_live_myocardial_acid_base_provider.js`
- `test/v16_live_myocardial_acid_base_provider.test.js`
- `.github/workflows/v16-myocardial-phi-provider.yml`

Commits:
- `a76f0a745f7618fcf724b9b1f8d141b89f55135e` — persistent nine-input myocardial acid-base provider.
- `de601a317b6c4c1b2a6ed17819c37af6de785251` — focused provider contract test.
- `0522ca4f9d0db79c9f96d739675c6eb28acc0d34` — focused v1.6 validation workflow.

Provider behavior:
- owns myocardial lactate mass internally;
- owns myocardial CO2/base mass internally;
- derives myocardial intracellular pH from the source-transcribed
  LeftHeart-Lactate + LeftHeart-CO2 + LeftHeart-Ph chain;
- accepts the nine upstream live states agreed with the physician;
- has no myocardial-pHi input field and does not substitute arterial pH;
- remains candidate-only and has no canonical control authority.

Current upstream status:
- blood SID: live gas-core state available;
- arterial HCO3-: live gas-core arterial state available;
- intracellular K: source provider exists; live coupling pending;
- LV liquid volume: source provider exists; live coupling pending;
- myocardial blood flow: source provider exists; live coupling pending;
- myocardial O2 use: source flow/metabolism chain exists; live coupling pending;
- anaerobic glucose use: source fuel relationship exists; live coupling pending;
- myocardial lactate use: source fuel relationship exists; live coupling pending;
- systemic lactate-pool concentration: source pool provider exists; whole-body live coupling pending.

Focused execution status at this checkpoint:
- GitHub workflow run `38330067273`;
- focused-provider job completed successfully;
- nine-input myocardial acid-base provider test: **PASS**;
- no full regression/deploy run was triggered.


### v1.6 checkpoint — live chemistry + myocardial flow/O2 coupling

Implemented:
- `src/v16_myocardial_live_input_adapter.js`
- `test/v16_myocardial_live_input_adapter.test.js`
- integrated candidate now exposes source-family coronary blood flow and
  myocardial O2 use in `cardiovascular.myocardialSourceState`
- `test/v16_integrated_myocardial_source_state.test.js`

Commits:
- `eb4c5f2847581cf64326628d2342906361db2e0e` — live SID/HCO3 adapter.
- `bb1cb077f7d92562bf36de1384909d6a8933d5f3` — chemistry adapter gate.
- `a2b4fce8510cc6fabf01348a3e7c2b27c3075878` — focused workflow expanded for live chemistry.
- `2c2af331bde9868ea5ca16a473980b900fc30892` — expose source coronary flow and myocardial O2 use.
- `45394380f243a918cc27b3f527ba8ab7a9130168` — source-output gate.
- `d00d526f79e9043b41b1652559daf3a8efb052f3` — focused workflow expanded for myocardial source outputs.

Myocardial pHi upstream status now:
- blood SID: **wired from live gas snapshot**
- arterial HCO3-: **wired from live gas snapshot**
- myocardial blood flow: **source-family value exposed from integrated coronary bed**
- myocardial O2 use: **source-family value exposed from Eq. 46 cardiac O2 consumption**
- intracellular K: blocked on whole-body KCell/KPool + CellH2O live state
- LV liquid volume: blocked on whole-body interstitial + cell-water live state
- anaerobic glucose use: source-transcribed, live coupling pending
- myocardial lactate use: source-transcribed, live coupling pending
- systemic lactate-pool concentration: source-transcribed, whole-body pool coupling pending

No new physiologic gain was added. The mL/s -> mL/min conversion is dimensional
only and is recorded explicitly in the candidate output.

Validation:
- prior persistent pHi provider gate: PASS, workflow run `38330067273`.
- latest chemistry + coronary-flow/O2 focused gate: workflow committed;
  latest run not yet registered at time of this checkpoint, so **result pending**.


### v1.6 negative/repair checkpoint — myocardial source output gate

Focused workflow run `38330175167`:
- persistent nine-input pHi provider: PASS
- live SID/HCO3 adapter: PASS
- integrated myocardial source outputs: FAIL

Failure:
- implementation variable-name error:
  `averageCardiacPumpPowerMmHgMlPerSec is not defined`
- this occurred while passing the already-computed averaged pump power into the
  Ursino/Magosso Eq. 46 myocardial O2-use function.
- no source equation, parameter, gain, or ownership decision failed.

Repair:
- commit `42aa61eb79980b69fb63d8c42dfe97dd010ebf6d`
- corrected the property binding to
  `averageCardiacPumpPowerMmHgMlPerSec: averagePumpPowerMmHgMlPerSec`.
- physiology unchanged.

Rerun:
- workflow `38330215758` completed **SUCCESS**;
- persistent pHi provider: PASS;
- live SID/HCO3 adapter: PASS;
- integrated coronary-flow/myocardial-O2 source output: PASS.



### v1.6 checkpoint — five of nine myocardial pHi inputs source/live-resolved

Additional implementation:
- `hummod_2013_left_heart_fuel.js` now exposes the source-owned
  LeftHeart anaerobic-glucose-use state explicitly.
- Exact HumMod 2013 source behavior is preserved:
  `AnaerobicGlucoseUsed(Cals/Min) = 0`, therefore the corresponding
  mg/min state is also zero.
- `v16_myocardial_live_input_adapter.js` now composes:
  1. blood SID from live gas state;
  2. arterial HCO3- from live gas state;
  3. myocardial blood flow from integrated Ursino/Magosso coronary-bed flow;
  4. myocardial O2 use from Ursino/Magosso Eq. 46 cardiac O2 consumption;
  5. anaerobic glucose use from the exact HumMod-2013 source statement.

Still unresolved/fail-closed:
1. intracellular K;
2. LV liquid volume;
3. myocardial lactate use;
4. systemic lactate-pool concentration.

Important blocker detail:
- current intracellular K cannot be replaced with a permanent 140 mEq/L value;
  the source provider requires dynamic KCell/KPool + CellH2O state.
- current LV liquid volume cannot be frozen at initial composition;
  the source provider requires live interstitial + cell-water compartments.

Commits:
- `acca45aed46d3280acc4ad9205892c2cb4f36b7e` — expose source-owned zero anaerobic glucose use.
- `8b3a26920561a473d5fb292dedf85d6bd577149b` — compose live flow/O2 + source anaerobic state.
- `c1142138dc6ec233f173702e3c3f7eecd97dc812` — ownership documentation correction.
- `905ba790aede0d45af8a17fac07826247901aa12` — gate 5 resolved / 4 unresolved myocardial inputs.

No physiology was tuned and no blocked water/K state was replaced with a fixed
normal value.


### v1.6 validation checkpoint — five-of-nine composition green

Focused workflow run `38330303818` completed **SUCCESS**.

Validated together:
- persistent nine-input myocardial acid-base provider;
- live blood-SID / arterial-HCO3 adapter;
- integrated coronary-flow + myocardial-O2 source outputs;
- source-owned HumMod-2013 zero anaerobic myocardial glucose use;
- composition contract with exactly four remaining unresolved live states.

Current unresolved states:
1. intracellular K;
2. LV liquid volume;
3. myocardial lactate use;
4. systemic lactate-pool concentration.

This is the current v1.6 recovery point for myocardial-pHi integration.


### v1.6 resume checkpoint — continue from green five-of-nine state

Physician direction: continue building v1.6 and save frequently to HANDOFF.md.

Verified branch recovery point before new work:
- v1.6 head at start of this pass: `d2254de48c11660c0b8ee58751c49d367699af34`;
- prior focused five-of-nine myocardial-pHi composition gate is green;
- do not repeat completed v1.6 work.

Current unresolved myocardial-pHi inputs remain:
1. intracellular K;
2. LV liquid volume;
3. myocardial lactate use;
4. systemic lactate-pool concentration.

Source dependency audit before coding:
- intracellular K is not a free scalar: HumMod-2013 requires persistent KCell mass and live CellH2O volume, with KPool mass and delayed aldosterone driving K fluxes;
- LV liquid volume is not a free scalar: it requires the source left-heart water scaling applied to live whole-body interstitial and cell-water compartments;
- systemic lactate concentration is not a free scalar: the HumMod-2013 pool requires the complete tissue-outflow network plus IV/pump terms and ECFV;
- myocardial lactate use is source-computable through LeftHeart-Fuel but depends on substrate/pool state, including systemic lactate concentration.

Decision:
- do not use fixed 140 mEq/L intracellular K;
- do not freeze LV liquid volume at initial composition;
- do not hold systemic lactate at its 1 mEq/L initialization;
- build the missing source-owned upstream runtimes beneath these states.

Next implementation: persistent HumMod-2013 KCell runtime, candidate-only and fail-closed on live KPool/cell-water inputs.


### v1.6 negative checkpoint — first KCell focused gate

Focused workflow run `38330464440` completed **FAILURE** after adding the persistent HumMod-2013 KCell runtime.

The preceding five-of-nine myocardial gates had been green. The new failure is isolated to the newly added KCell focused gate until proven otherwise.

No physiology will be changed in response to the failed gate. The failure is being inspected before repair; any correction must preserve the source equations:
- `KCell.Change = KFluxToCell.Rate - KFluxToPool.Rate`;
- `KFluxToCell.Rate = 0.0018 * KAldoEffect.Delayed * KPool.Mass`;
- `KFluxToPool.Rate = 8e-5 * (KCell.Mass - 2180)`.


### v1.6 repair checkpoint — KCell workflow failure was YAML, not physiology

The first two KCell workflow runs did not start a job. GitHub exposed the workflow path as the run name and returned an empty job list.

Root cause:
- the workflow edit inserted literal `\\n` sequences into the YAML path list;
- this invalidated the workflow before Node tests executed.

Therefore:
- there is **no KCell physiology/test failure established by those runs**;
- source equations remain unchanged;
- the workflow YAML was repaired in commit `e35145cf81acd0076d96793d804f52afa17e6e8a`;
- focused rerun result is pending at this checkpoint.


### v1.6 checkpoint — persistent KCell runtime green; systemic lactate runtime added

KCell implementation:
- added `src/hummod_2013_kcell_runtime.js`;
- preserves source equation `KCell.Change = KFluxToCell.Rate - KFluxToPool.Rate`;
- preserves HumMod-2013 constants `BasicK=0.0018/min`, `BasicK=8e-5/min`, and `CaptiveMass=2180 mEq`;
- uses exact zero-order-hold integration of the linear continuous source mass equation;
- derives intracellular K concentration from persistent KCell mass / live CellH2O volume;
- remains candidate-only and fails closed without KPool mass, delayed aldosterone effect, and CellH2O volume.

Validation:
- workflow YAML failure was repaired without physiology changes;
- focused workflow run `38330536094` completed **SUCCESS**;
- the prior five-of-nine myocardial-pHi gates remained green in the same focused workflow.

Systemic lactate implementation:
- added `src/hummod_2013_systemic_lactate_pool_runtime.js`;
- preserves source `LacPool.Change` as the sum of 13 organ lactate outflows + IVDrip.LacRate + PumpRate;
- concentration is derived from persistent mass / live ECFV;
- no fixed 1 mEq/L concentration is used after initialization;
- fails closed if any required organ outflow is absent.

Systemic lactate focused gate has been committed and is pending at this checkpoint.

Myocardial-pHi architecture consequence:
- intracellular K is no longer blocked on a missing KCell equation/runtime; it is blocked one layer upstream on live KPool/aldosterone/cell-water state;
- systemic lactate concentration is no longer blocked on a missing LacPool equation/runtime; it is blocked one layer upstream on the full organ lactate-outflow network and live ECFV.


### v1.6 checkpoint — LV liquid volume green; nine-state upstream composer added

LV liquid-volume implementation:
- added `src/hummod_2013_left_heart_liquid_volume_runtime.js`;
- preserves the source initialization-derived left-heart fraction of total tissue water;
- current LV liquid volume is derived only from live whole-body interstitial + cell-water volumes;
- no frozen initial LV liquid-volume substitution is used.

Validation:
- focused workflow run `38330636489` completed **SUCCESS**;
- prior myocardial-pHi, chemistry, coronary/O2, KCell, and systemic-lactate gates remained green.

Composition layer:
- added `src/v16_myocardial_upstream_runtime.js`;
- composes live gas SID/HCO3, integrated coronary flow/O2 use, source zero anaerobic glucose use, persistent KCell-derived intracellular K, persistent LV-water-derived liquid volume, and persistent systemic LacPool concentration into the nine-input myocardial acid-base boundary;
- myocardial lactate use remains the only direct myocardial input at this composition layer because its HumMod LeftHeart-Fuel equation needs additional live substrate/metabolic states not yet exposed by the cardiopulmonary candidate.

The upstream composition focused gate is pending at this checkpoint.


### v1.6 checkpoint — myocardial upstream composition gate green

Focused workflow run `38330701408` completed **SUCCESS**.

Validated together:
- persistent nine-input myocardial acid-base provider;
- live SID/HCO3 chemistry adapter;
- integrated coronary flow + myocardial O2 use;
- source-owned zero anaerobic glucose use;
- persistent KCell runtime;
- persistent systemic lactate-pool runtime;
- live left-heart liquid-volume runtime;
- nine-state myocardial upstream composition runtime.

Current direct unresolved myocardial-pHi dependency at the composition boundary:
- myocardial lactate use.

The HumMod-2013 LeftHeart-Fuel equation for myocardial lactate use is already transcribed, but requires additional live metabolic/substrate inputs: insulin receptor binding, glucose pool concentration, fatty-acid pool concentration, plasma flow, myocardial lactate concentration, aerobic caloric use, total caloric use, and myocardial O2 use. These will be audited and wired source-first; no normal defaults will be substituted.
