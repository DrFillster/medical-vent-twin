# CURRENT RECOVERY POINT — READ THIS FIRST

**Active branch:** `v1.6`  
**Last governance commit at this checkpoint:** `30dbd10479da7713f01249d2d4436de3f3333e27`  
**Current milestone:** **Finish the physician-testable integrated ARDS candidate first.**

## Current objective

Assemble one persistent ARDS cardiopulmonary patient using the sourced modules already built.

Immediate order:
1. ARDS gas exchange and V/Q/shunt authority.
2. Pulmonary vascular / RV-load coupling.
3. Vent pressure/PEEP effects on the cardiovascular candidate.
4. Myocardial O2/pHi/contractility reconnection.
5. Physician validation candidate.
6. Only then resume sepsis/vasoplegia and pressors.

## Current architecture

- **Vent** owns ventilator settings, airway mechanics, recruitment, pressures, holds, and waveforms.
- **Ursino/Magosso source-family candidate** owns candidate cardiovascular/autonomic physiology.
- **HumMod source-aligned gas equations** are the current ARDS gas-exchange candidate.
- **HumMod-2013 myocardial source chain** provides the candidate intracellular pHi / contractility path.
- Pulmonary vascular/RV coupling remains candidate work in progress.
- Sepsis and pressors are intentionally deferred until ARDS is physician-testable.

## Current ARDS build

Newest ARDS composition:
- `src/v16_ards_pulmonary_gas_candidate.js`
- focused test: `test/v16_ards_pulmonary_gas_candidate.test.js`
- focused workflow: `.github/workflows/v16-ards-candidate.yml`

The ARDS composition is deliberately fail-closed:
- static phenotype `perfusionFraction * recruitment` is **not** accepted as final V/Q/perfusion physiology;
- `FRC + Vent.totalVolume` is **not** accepted as absolute alveolar volume;
- pulmonary perfusion must come from a source-qualified provider.

## Current myocardial state

The pHi chain is substantially source-transcribed. Do **not** continue broad endocrine/metabolic reconstruction merely because a dependency exists.

Completed or source-transcribed pieces include:
- blood SID;
- arterial HCO3-;
- myocardial blood flow;
- myocardial O2 use;
- anaerobic glucose use;
- KCell runtime;
- LV liquid-volume runtime;
- systemic lactate-pool runtime;
- LeftHeart-Fuel live bridge;
- glucose and fatty-acid pools;
- plasma-fraction provider.

These are preserved, but ARDS integration has priority.

## Do not do now

- no sepsis activation;
- no pressor/inotrope activation;
- no broad whole-body HumMod reconstruction;
- no unnecessary endocrine expansion;
- no UI polish unrelated to physician validation;
- no invented gains or coordinate bridges;
- no tuning merely to make outputs look clinically familiar.

## Last important correction

The project briefly regressed into solving every newly discovered upstream dependency. That is now explicitly prohibited by:
- root `START_HERE.md`;
- root `candidate-state.json`;
- root `AGENTS.md`.

A newly discovered dependency is not automatically the next task. First determine whether it is required to reach the current ARDS milestone.

## Continuation rule

Every new conversation/agent must begin with:

1. live `v1.6` branch HEAD;
2. root `START_HERE.md`;
3. root `candidate-state.json`;
4. this recovery block;
5. the relevant equation/source ledger;
6. only then the implementation/tests.

If remembered context conflicts with repository state, repository state wins.

---

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


### v1.6 checkpoint — live LeftHeart-Fuel bridge added

A source-faithful live fuel bridge was added:
- `src/v16_left_heart_fuel_live_bridge.js`
- `test/v16_left_heart_fuel_live_bridge.test.js`

Key architecture:
- myocardial lactate use is no longer treated as an arbitrary free scalar when the source metabolic inputs are available;
- the bridge uses the **previous myocardial lactate state** from the persistent myocardial acid-base/lactate runtime, current coronary flow and myocardial O2 use from the integrated cardiopulmonary candidate, and current systemic lactate concentration from the persistent LacPool runtime;
- plasma flow is derived dimensionally from coronary blood flow × live plasma-volume fraction;
- aerobic calories are derived from current myocardial O2 use using the HumMod-2013 `O2_TO_CAL` conversion;
- total caloric demand is derived through the HumMod-2013 LeftHeart-Metabolism provider;
- myocardial lactate use is then computed by the already-transcribed HumMod-2013 LeftHeart-Fuel equation.

The remaining live metabolic states required by the fuel bridge are explicit and fail-closed:
1. plasma-volume fraction;
2. insulin receptor bound fraction;
3. glucose-pool concentration;
4. fatty-acid-pool concentration;
5. current myocardial mass;
6. initial myocardial mass;
7. thyroid effect;
8. heat-metabolism core effect;
9. myocardial structure effect.

No normal defaults are substituted for those states.

Focused LeftHeart-Fuel bridge workflow committed; result pending at this checkpoint.


### v1.6 checkpoint — substrate pools and plasma-fraction provider added

Validated before this checkpoint:
- live LeftHeart-Fuel bridge workflow run `38330892111`: **SUCCESS**.

New source runtimes:
- `src/hummod_2013_glucose_pool_runtime.js`
  - persistent GlucosePool mass;
  - concentration = Mass / ECFV.Vol;
  - source gain/loss terms remain explicit and fail-closed.
- `src/hummod_2013_fatty_acid_pool_runtime.js`
  - persistent FAPool mass;
  - concentration = Mass / ECFV.Vol;
  - source gain/loss terms remain explicit and fail-closed.

New blood-state provider:
- `src/hummod_2013_blood_volume_fraction_provider.js`
- preserves source equations:
  `BloodVol.Vol = RBCVol.Vol + PlasmaVol.Vol`;
  `Hct = RBCVol.Vol / BloodVol.Vol`;
  `PVCrit = 1 - Hct`;
- this is the intended live plasma-volume fraction for LeftHeart-Fuel plasma-flow derivation.

No fixed hematocrit or plasma fraction is used as a live substitute.

Focused glucose/FAPool gate and blood-volume-fraction gate have been committed; current results pending at this checkpoint.


### v1.6 governing clinical scope correction — ARDS + sepsis + ventilation + pressors

Physician direction: v1.6 is specifically an **ARDS/sepsis cardiopulmonary digital twin under mechanical ventilation and vasoactive support**. Do not drift into rebuilding general whole-body HumMod unless a subsystem is directly required to close a clinically important cardiopulmonary state.

Priority clinical loop:
1. Vent remains owner of airway mechanics, pressures, PEEP, recruitment, delivered VT and breath timing.
2. Pulmonary/gas layer supplies PaO2/PaCO2 and pulmonary vascular consequences relevant to ARDS.
3. Cardiovascular plant supplies LV/RV/systemic/pulmonary hemodynamics and regional perfusion.
4. Sepsis layer must support vasoplegia/distributive physiology rather than treating SVR changes as arbitrary user scalars.
5. Vasoactive drugs/pressors/inotropes must act through explicit receptor/efferent mechanisms where source-supported, not through direct MAP targets.
6. Coronary perfusion + myocardial O2/metabolic state -> myocardial intracellular pH -> contractility/mechanics.
7. Systemic perfusion/metabolic mismatch -> lactate dynamics when source-complete.

Scope rule:
- endocrine/metabolic modules such as insulin, glucose, fatty-acid, K, water, etc. are included only to the extent needed to close myocardial energetics/acid-base or another bedside-critical ARDS/sepsis state;
- do **not** expand those systems into a general endocrine/metabolic simulator before the ARDS/sepsis/pressor candidate is physician-testable.

Immediate reprioritization:
- finish only the minimum source-complete myocardial-lactate/pHi dependencies;
- then return to ARDS pulmonary vascular/RV coupling, septic vasoplegia, and pressor/inotrope integration;
- physician validation should focus on trajectories under hypoxemia, hypercapnia/acidemia, increasing PEEP/airway pressure, distributive shock, norepinephrine/vasopressin/inotrope support, and eventual myocardial decompensation if produced by the equations.


## Anti-regression governance checkpoint

Implemented on v1.6:
- root `START_HERE.md` — one-page orientation and current work order;
- root `candidate-state.json` — machine-readable milestone, ownership, deferred work, and forbidden shortcuts;
- root `AGENTS.md` — mandatory startup/continuation contract for future AI/agent sessions;
- top-of-file `CURRENT RECOVERY POINT` block in this HANDOFF;
- `test/v16_governance_consistency.test.js` — checks that branch/version/milestone/deferred scope/forbidden shortcuts remain aligned;
- `.github/workflows/v16-governance-consistency.yml` — tiny governance-only gate, no build/deploy/physiology suite.

Governance commits:
- `1d1d9eaf8fc6e2017047260b8db5af915c6958bf` — START_HERE;
- `2f221d8292bd30f91cc8c633a547fcd8ddd8e222` — candidate-state.json;
- `30dbd10479da7713f01249d2d4436de3f3333e27` — AGENTS.md;
- `c5c2d72a03b7dfd6cf2018af2a0a5fcab7bb3e78` — current recovery block;
- `5d97684b1c7bfe3330ab6dfdb65e2337feb9ba52` — consistency test;
- `5bf3a4f6b6b0d05d96f9ffa164070f4fdc8d652f` — governance workflow.

The first governance workflow had not yet registered a run when checked immediately after commit. Do not call the governance gate green until a run actually executes successfully.


## v1.6 ARDS build checkpoint — integrated pulmonary vascular/gas/cardiovascular spine

Governance recovery gate:
- workflow `38331801840`: **SUCCESS**.

Prior focused ARDS pulmonary-gas gate:
- workflow `38331382939`: **SUCCESS**.

New pulmonary vascular runtime:
- `src/v16_karamolegkos_pulmonary_vascular_runtime.js`;
- preserves Karamolegkos Appendix pulmonary state equations using transmural pressure coordinates;
- requires source-qualified external absolute alveolar volume, alveolar pressure, pleural pressure, shunt fraction, and capillary resistance;
- consumes RV outflow and LA pressure from the cardiovascular candidate;
- does **not** map Vent elastic volume to Karamolegkos absolute V_A;
- exports a source-qualified pulmonary perfusion state for the gas runtime.

New integrated ARDS composition:
- `src/v16_integrated_ards_cardiopulmonary_candidate.js`;
- composes one persistent candidate patient using:
  1. Vent mechanics;
  2. source-qualified pulmonary mechanics coordinates;
  3. Karamolegkos pulmonary vascular runtime;
  4. HumMod source-aligned ARDS gas exchange;
  5. Ursino/Magosso cardiovascular/autonomic candidate;
- sequential coupling order is pulmonary vascular -> gas -> cardiovascular;
- no physiologic gain is added by the composition layer;
- PaO2/PaCO2 from the gas state feed the cardiovascular/autonomic candidate on the same persistent runtime;
- RV outflow and LA pressure feed the pulmonary vascular state on subsequent split steps.

Focused tests added:
- `test/v16_karamolegkos_pulmonary_vascular_runtime.test.js`;
- `test/v16_integrated_ards_cardiopulmonary_candidate.test.js`.

Current validation state:
- pulmonary vascular focused workflow `38332224996` was queued at last check;
- integrated ARDS workflow commit `1ca4cdd29c6592fb2a560f6111bc5c0ae15d471b` had not yet registered a run at last check;
- therefore the integrated spine is **built but not yet execution-verified** at this checkpoint.

Remaining hard ARDS boundary:
- source-qualified global pulmonary mechanics coordinates `V_A`, `P_A`, and `P_pl`;
- source-qualified Karamolegkos shunt and `R_pc` values;
- no convenience bridge is authorized.


## v1.6 positive checkpoint — integrated ARDS spine green

Focused validation results:
- governance consistency workflow `38331801840`: **SUCCESS**;
- ARDS pulmonary-gas workflow `38331382939`: **SUCCESS**;
- Karamolegkos pulmonary vascular workflow `38332224996`: **SUCCESS**;
- integrated ARDS cardiopulmonary workflow `38332342937`: **SUCCESS**.

Important negative result preserved:
- integrated workflow `38332291750` initially failed because the composition exported instantaneous **RV ejection flow** as total pulmonary blood flow for gas exchange;
- RV valve outflow is pulsatile and legitimately reaches zero between ejections;
- gas exchange requires downstream pulmonary peripheral perfusion, not instantaneous valve outflow;
- corrected export is `Q_pal + Q_ps` from the Karamolegkos pulmonary state;
- no physiologic gain, parameter, or source equation was changed.

Current integrated owner chain:
`Vent mechanics -> source-qualified pulmonary coordinates -> Karamolegkos pulmonary vascular state -> HumMod ARDS gas state -> PaO2/PaCO2 -> Ursino/Magosso cardiovascular/autonomic candidate -> RV outflow/LA pressure -> pulmonary vascular state`.

Current ARDS hard boundaries, in priority order:
1. verify/close Karamolegkos `R_pc` from the primary source;
2. preserve shunt as explicit source/case state (normal and ARDS-study values must not be conflated);
3. create a source-valid Vent-compatible `P_A/P_pl/V_A` coordinate adapter without replacing Vent mechanics or using `FRC + Vent.totalVolume`;
4. only after these are closed, run physician ARDS perturbations (PEEP, VT, RR, FiO2/airway pressure) through the integrated patient.


## v1.6 positive checkpoint — Karamolegkos R_pc source closure

Primary-source Appendix audit closed a previously artificial runtime boundary.

Source equations:
- A20: `R_pc = R_pal@FRCnom`;
- A22: `R_pp,total = 2 * (1-sh) * R_pal@FRCnom`;
- A25: `R_pc = R_pp,total / [2 * (1-sh)]`;
- A15: `Q_ps = sh/(1-sh) * Q_pal`, so explicit `R_ps` is unnecessary.

Implementation changes:
- `karamolegkos_pulmonary_circulation_candidate.js` now derives `R_pc` internally from A25;
- `v16_karamolegkos_pulmonary_vascular_runtime.js` no longer accepts an external capillary resistance;
- stale v1.5 test claiming R_pc was unverified was replaced by a direct A25 gate;
- integrated ARDS fixtures no longer supply R_pc.

Focused ARDS workflow `38332594818`: **SUCCESS**.

Remaining pulmonary source boundaries:
1. shunt/VQ state;
2. Vent-compatible source coordinate for alveolar volume/pressure and pleural pressure.


## v1.6 negative checkpoint — unified regional O2 integration gate

Focused workflow `38333328696` completed **FAILURE** at the final integrated ARDS cardiopulmonary test.

All upstream ARDS steps in the same workflow passed:
- ARDS pulmonary gas candidate;
- Karamolegkos source equations/A25;
- Karamolegkos pulmonary vascular runtime;
- Das human-ARDS regional perfusion;
- Marshall HPV candidate;
- Das-Marshall regional HPV perfusion;
- regional ARDS O2-perfusion fixed point;
- Vent regional alveolar ventilation adapter;
- Vent regional ARDS oxygen bridge.

Therefore the failure is currently classified as an **integration/composition failure**, not an upstream physiology failure. No source equation or physiologic parameter will be changed until the exact failing assertion/stack is inspected.


### v1.6 regional O2 integration failure classification

Workflow `38333389670` reached the integrated ARDS test and the runtime executed. The only failing assertion was a string-match mismatch:
- runtime authority text: `Vent + Das-Marshall regional VQ/HPV + HumMod blood-O2 candidate`;
- test expected the literal substring `Das/Marshall regional VQ`.

Classification: **test-fixture wording failure**, not physiology or integration failure.

No physiology/source code will be changed for this failure. Only the authority-string assertion will be made semantically tolerant of the existing documented wording.


## v1.6 positive checkpoint — unified regional ARDS oxygen state green

Focused workflow `38333451380`: **SUCCESS**.

All focused ARDS gates passed together:
1. HumMod source-aligned pulmonary gas candidate;
2. Karamolegkos source equations including Appendix A25;
3. Karamolegkos pulmonary vascular runtime;
4. Das human-ARDS regional perfusion equations;
5. Marshall HPV candidate;
6. Das-Marshall regional HPV/perfusion composition;
7. regional ARDS O2-perfusion fixed point;
8. Vent regional alveolar ventilation adapter;
9. Vent regional ARDS oxygen bridge;
10. integrated ARDS cardiopulmonary candidate.

Current O2 architecture:
- Vent supplies measured regional alveolar tidal ventilation;
- Das/Marshall allocates non-shunt pulmonary perfusion dynamically from regional alveolar PO2 and mixed-venous PO2;
- Karamolegkos supplies total pulmonary peripheral flow and anatomical shunt;
- regional end-capillary O2 contents are flow-mixed, then anatomical shunt is applied;
- the resulting source-qualified arterial O2 content is fed back into the persistent HumMod arterial O2 state through the existing HumMod first-order arterial delay;
- HumMod remains the CO2/pH authority;
- the Ursino/Magosso cardiovascular/autonomic candidate receives the resulting persistent PaO2/PaCO2 state.

Legacy Vent `perfusionFraction` metadata is not used by this regional oxygenation path.

The prior failure in workflow `38333389670` was confirmed to be test wording only and was corrected without physiology changes.

Remaining major ARDS mechanics boundary:
- source-valid translation from Vent volume/pressure coordinates to Karamolegkos absolute alveolar volume `V_A`, alveolar pressure `P_A`, and pleural pressure `P_pl` for dynamic PVR/RV loading.


## v1.6 positive checkpoint — Vent-driven pulmonary coordinates + regional V/Q/O2 integrated

Focused ARDS workflow `38333520882`: **SUCCESS**.

This checkpoint closes two major ARDS integration boundaries without changing Vent mechanics or adding fitted physiology.

### Regional V/Q / oxygen authority

The integrated patient now contains the source-traceable chain:
`Vent regional completed-breath ventilation -> HumMod BTPS/STPD + blood O2 relations -> regional alveolar PO2 -> Marshall HPV response -> Das regional pulmonary resistance/perfusion -> non-shunt capillary O2 mixing -> Karamolegkos anatomical shunt mixing -> arterial O2`.

Key implementation files:
- `src/v16_das_ards_regional_perfusion_candidate.js`;
- `src/v16_marshall_hpv_candidate.js`;
- `src/v16_das_marshall_regional_hpv_perfusion.js`;
- `src/v16_regional_ards_o2_perfusion_candidate.js`;
- `src/v16_vent_regional_alveolar_ventilation_adapter.js`;
- `src/v16_vent_regional_ards_oxygen_bridge.js`.

Vent legacy `perfusionFraction` metadata is not used by this path. Low V/Q is modeled regionally and is not relabeled as anatomical shunt.

The source-qualified regional arterial O2 target is also fed back into the HumMod gas runtime on the following operator-split step, so the persistent gas/venous extraction state and the cardiovascular/autonomic candidate share the same regional O2 authority. The one-step feedback lag is numerical operator splitting, not a physiologic delay or gain.

### Vent -> Karamolegkos pulmonary mechanics coordinates

New coordinate translator:
- `src/v16_albanese_karamolegkos_pulmonary_coordinate_runtime.js`;
- source equations Albanese 2016 A30-A36;
- passive mechanical-ventilation boundary (`dPmus/dt = 0`);
- input is Vent airway-opening pressure;
- outputs source-native alveolar pressure `P_A`, pleural pressure `P_pl`, and absolute alveolar volume `V_A`;
- `V_A` initializes at Karamolegkos nominal FRC 2.25 L and evolves via source Eq. A36;
- Vent elastic volume is never used as absolute alveolar volume.

The integrated ARDS candidate now uses this translator by default. External `pulmonaryMechanicsBoundaryProvider` remains only as an explicit source-qualified override/debug path.

### Current remaining ARDS boundary

**Anatomical shunt fraction** remains explicit. Do not derive it from low V/Q, Berlin grade, recruitment fraction, or Vent legacy perfusion metadata without a sourced case relationship.

Normal Karamolegkos physiology and ARDS study-specific shunt values must remain distinct. The next build target is a physician-testable ARDS perturbation candidate with a clearly authored/source-qualified anatomical-shunt case state, not a universal inferred shunt formula.


## v1.6 milestone — persistent physician-testable ARDS candidate green

Focused ARDS workflow `38333725034`: **SUCCESS**.

New physician candidate:
- `src/v16_physician_ards_candidate.js`;
- focused test: `test/v16_physician_ards_candidate.test.js`.

The candidate owns no new physiology. It keeps one real Vent `Simulation` and one v1.6 integrated cardiopulmonary runtime alive across interventions.

Explicit required case inputs remain explicit:
- Vent mechanical phenotype;
- starting recruitment state;
- starting ventilator settings;
- anatomical shunt fraction;
- excess lung water;
- blood/metabolic/environment boundaries.

No Berlin-severity -> shunt/recruitment/hemodynamic inference is performed.

Physician-facing persistent outputs now include:
- PaO2, PaCO2, arterial pH;
- regional alveolar PO2, HPV coefficient, and perfusion fraction;
- HR, time-averaged MAP, CO, SV, SVR;
- mean PAP, RAP, LAP, derived PVR;
- Vent settings, airway pressure, lung elastic volume, recruitment state;
- intervention and measurement history.

The hemodynamic bedside outputs use completed time-averaging windows; instantaneous pulsatile valve outflow is not reported as cardiac output.

Validated persistent interventions:
- PEEP change through Vent `setPEEP()` without patient reset;
- VT/RR/FiO2/controller change queued and applied at a breath boundary without patient reset.

Current milestone status:
- **backend physician-testable integrated ARDS candidate achieved**;
- next step is physician browser exposure / perturbation review, not additional broad physiology expansion;
- myocardial O2/pHi/contractility reconnection remains the next physiology item after ARDS physician exposure;
- sepsis/pressors remain deferred.


## v1.6 negative checkpoint — regional oxygen promotion integration gate

Workflow `38333235127`: **FAILURE**.

Classification: **test fixture / integration harness**, not physiology.

Evidence from the same focused workflow:
- ARDS pulmonary gas: PASS;
- Karamolegkos source equations: PASS;
- Karamolegkos pulmonary vascular runtime: PASS;
- Das regional perfusion: PASS;
- Marshall HPV: PASS;
- Das-Marshall HPV/perfusion: PASS;
- regional ARDS O2/perfusion fixed point: PASS;
- Vent regional alveolar-ventilation adapter: PASS;
- Vent regional ARDS oxygen bridge: PASS;
- integrated ARDS candidate: FAIL.

Exact failure:
`Vent simulation state and parameters are required` from `deriveRegionalVentilationAudit()`.

Cause:
- the integrated-candidate test mock supplied `simulation.params.airwayOpeningPressure` but did not supply `simulation.params.compartments`;
- the promoted regional ventilation adapter requires Vent compartment parameters by design.

Decision:
- do not change physiology;
- repair only the integrated test fixture to include the same Vent compartment parameter structure used by the already-green regional adapter tests.


## v1.6 negative checkpoint — reference-qualified integrated ARDS path

Focused workflow `38333906067` completed **FAILURE** at the final integrated ARDS cardiopulmonary candidate step.

All upstream ARDS components passed in the same workflow, including:
- ARDS pulmonary gas candidate;
- Karamolegkos source equations/A25;
- Albanese-Karamolegkos source-coordinate shadow runtime;
- Karamolegkos pulmonary vascular runtime;
- Das/Marshall regional perfusion and HPV;
- regional O2-perfusion fixed point;
- Vent regional alveolar ventilation and oxygen bridge;
- reference-anchored absolute alveolar volume adapter;
- passive Vent-Karamolegkos pressure-coordinate adapter.

Classification at this checkpoint: **integrated default-path failure**, not an upstream source-equation failure. The exact stack/assertion is being inspected before any change. No physiology parameter or equation will be altered until the cause is classified.


## v1.6 browser-exposure checkpoint — source session + UI wiring in progress

Negative result preserved:
- focused workflow `38334192522`: **FAILURE**;
- all upstream ARDS component/source tests passed;
- failure occurred when the persistent physician candidate was still using the superseded implicit pulmonary-coordinate contract;
- exact error: `pulmonaryCoordinateAdapter.snapshot is required when no explicit pulmonaryMechanicsBoundaryProvider is supplied`;
- this was an integration-contract mismatch after the live branch moved to the reference-anchored Vent volume + passive Albanese/Karamolegkos pressure-coordinate adapters, not a physiology-output mismatch.

Current live architecture after correction:
- `v16_physician_ards_candidate.js` constructs:
  - reference-anchored absolute alveolar volume from synchronized Vent volume change;
  - passive Albanese/Karamolegkos pleural/alveolar pressure coordinate;
  - explicit source-qualified anatomical shunt case state;
- the integrated runtime derives its split pulmonary vascular initialization from those synchronized source coordinates rather than requiring guessed `Ppal/Ppc` values.

Browser work committed:
- `src/clinical_twin_v16_ards_session.js` — v1.6 browser/session adapter;
- `test/v16_clinical_twin_browser_session.test.js` — session contract;
- `src/browser-entry.js` exports the v1.6 session;
- `web/clinical-worker.js` routes provider `v16-integrated-ards`;
- `web/index.html` exposes the v1.6 provider plus explicit anatomical-shunt and excess-lung-water inputs;
- `web/app.js` makes v1.6 the physician quick-start provider while retaining legacy reduced-HumMod and replay as research modes;
- `test/v16_physician_browser_ui_contract.test.js` gates provider/UI plumbing;
- the focused ARDS workflow now also builds the browser bundle and verifies that `createBerlinV16ArdsSession` is exported.

Reference-case browser inputs:
- 35% anatomical shunt is labeled specifically as the Karamolegkos/Dhainaut sedated-ARDS validation value, not a Berlin-derived universal shunt;
- excess lung water is visible and explicit; no clinically unvalidated HumMod sensitivity-sweep value is hidden as a default.

At this checkpoint, workflow `38334499150` is still executing the persistent physician-candidate step. Do not call the browser candidate green until that run reaches the browser-session/build steps and completes successfully.
