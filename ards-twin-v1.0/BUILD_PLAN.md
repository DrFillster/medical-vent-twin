# ARDS Digital Twin Build Plan

Status: active build plan  
Branch: `v1.5`  
Scope target: v1.5 evidence-first autonomic/respiratory modernization

## 1. Product intent

Build a clinically credible **education and research simulator** in which a learner or investigator can manage a realistic synthetic ARDS patient over time, change ventilator settings and bedside interventions, and observe internally consistent pulmonary and systemic responses.

The application is not a bedside decision-support device and must not imply patient-specific clinical validation.

The v0.5 architecture will deliberately combine two models:

1. **Vent lung/ventilator engine** — high-resolution ventilator mechanics, compartmental lung heterogeneity, recruitment/derecruitment, waveforms, breath maneuvers, pressure/volume relationships, ventilator interventions, and pulmonary outputs.
2. **HumMod systemic physiology engine** — whole-body cardiovascular, blood-gas/acid-base, metabolic, fluid/renal, neurohumoral, and other systemic physiology where HumMod provides a stronger model than this project should recreate.

The clinical case layer binds those engines into deterministic, inspectable synthetic virtual patients.

## 2. Non-negotiable design rules

### 2.1 Berlin severity is not a mechanics phenotype

Berlin ARDS severity is represented as a clinical/oxygenation axis. Recruitability, compliance, resistance, dead space, shunt and hemodynamic state are separate axes. The simulator must never silently infer high recruitability, low compliance, or a particular pressure response solely from a Berlin severity label.

### 2.2 Start with realistic synthetic patients

The first clinical catalog is a deterministic 3 x 3 matrix:

- mild Berlin ARDS x low / moderate / high recruitability
- moderate Berlin ARDS x low / moderate / high recruitability
- severe Berlin ARDS x low / moderate / high recruitability

These are **synthetic virtual patients calibrated to published cohort envelopes**, not deidentified real patients. Every case must identify which fields are evidence-calibrated and which are explicit modeling/scenario assumptions.

### 2.3 HumMod is part of the target architecture

HumMod is not an optional future citation. The build must support actual HumMod-derived state. The current public HumMod standalone repository contains the model description hierarchy plus a Windows executable; the browser application therefore needs an adapter boundary rather than hard-coding HumMod internals into the lung model.

No HumMod variable name will be guessed. Mappings must be explicit, versioned, testable, and documented against the HumMod source/version used.

### 2.4 No false physiologic or clinical validation claims

Each output should eventually carry a provenance/status tag such as:

- directly modeled by Vent mechanics
- supplied by HumMod
- cohort-calibrated target
- synthetic scenario assumption
- derived from a validated measurement/calculator
- experimental / not clinically validated

The existing browser gas-exchange approximation remains unsuitable for clinical scoring until replaced or validated.

### 2.5 Longitudinal state matters

A virtual patient is not a stateless preset. PEEP changes, holds, recruitment/derecruitment, ventilator mode changes, systemic physiology, and prior interventions must persist in a run and affect subsequent state.

## 3. Target architecture

```text
Clinical case definition
  - Berlin severity
  - etiology/scenario metadata
  - recruitability/mechanics phenotype
  - evidence-calibrated targets
  - explicit assumptions
              |
              v
+---------------------------+       +---------------------------+
| Vent pulmonary engine     | <---> | Coupling / interchange    |
|                           |       |                           |
| ventilator controller     |       | typed snapshots          |
| lung compartments         |       | intervention events       |
| recruitment history       |       | time synchronization      |
| airway pressure/flow      |       | provenance                |
| holds + waveforms         |       +-------------+-------------+
+-------------+-------------+                     |
              |                                   v
              |                         +-------------------------+
              |                         | HumMod provider         |
              |                         |                         |
              +------------------------>| systemic physiology     |
                                        | gas/acid-base           |
                                        | hemodynamics            |
                                        | metabolism/fluid state  |
                                        +-------------------------+
```

For a static browser deployment, HumMod state can initially enter through deterministic exported trajectory/replay snapshots. A live coupled configuration can later use a small provider service around the supported HumMod runtime. Both routes must use the same normalized snapshot contract.

## 4. Workstreams

### A. Clinical virtual-patient catalog

**v0.5 requirement:** nine deterministic starting patients.

Each case must include:

- stable case ID and display name
- `synthetic: true`
- Berlin severity
- independent recruitability phenotype
- synthetic etiology/scenario description
- published cohort calibration envelope
- starting ventilation targets (mode, PEEP, FiO2, respiratory rate where explicitly authored, and VT expressed as mL/kg PBW rather than silently calculating patient-specific mL)
- mechanics calibration targets
- gas-exchange calibration targets
- explicit recruitment-history initialization requirement
- HumMod/systemic-state linkage status
- provenance metadata distinguishing evidence from assumptions

**Acceptance tests**

- exactly nine baseline cases
- complete 3 x 3 severity/recruitability matrix
- no duplicate IDs
- all cases marked synthetic
- every cohort-calibrated value has provenance
- every authored case assumption is labeled as an assumption
- changing recruitability does not silently change Berlin severity or its cohort P/F target

### B. Vent lung/ventilator mechanics

Already in progress:

- persistent PEEP changes during a simulation run
- intervention history
- separation of clinical severity from mechanical presets

Required next:

- trustworthy total PEEP / intrinsic PEEP measurement
- explicit inspiratory and expiratory hold maneuvers
- plateau pressure derived from a valid hold state rather than a convenient waveform sample
- driving pressure based on measured plateau and total PEEP when those measurements are available
- volume, pressure, and flow waveform annotations
- complete ventilator setting state and event log
- validated PBW workflow before exposing patient-specific mL/kg calculations in the UI

### C. HumMod integration

Implement in stages while preserving one adapter interface.

#### C1. Explicit snapshot mapper — now

- map a source object/export to `digital_twin_contract.js`
- mapping paths are configuration, not guessed constants
- missing optional source fields map to `null`
- missing required source fields fail loudly
- provider/source version recorded with each run

#### C2. Deterministic HumMod replay

- import exported HumMod time-series snapshots
- normalize them through the same adapter
- synchronize systemic state to simulator time
- use this to build reproducible educational scenarios and regression tests

#### C3. Live HumMod provider

- run the supported HumMod engine outside the browser when necessary
- expose a narrow provider API to initialize, step/sample, and apply supported interventions
- keep HumMod runtime details out of the browser lung core
- define bidirectional coupling ownership before enabling feedback loops

#### C4. Coupling validation

Before enabling closed-loop exchange, document ownership and units for each coupled variable. Avoid circular authority (for example, two engines independently determining the same arterial gas variable).

### D. Gas exchange and acid-base

The current browser gas model is explicitly provisional. The v0.5 clinical twin should move gas exchange toward a mass-balance/time-integrated model or obtain appropriate systemic gas/acid-base state from HumMod with a clearly defined pulmonary exchange interface.

Acceptance criteria before a gas value is used for clinical classification or intervention scoring:

- time-integrated ventilation rather than instantaneous absolute flow proxy
- explicit inspired oxygen and alveolar/pulmonary exchange handling
- shunt/dead-space treatment with documented equations
- unit tests over physiologic edge cases
- benchmarking against published distributions and predefined reference cases
- no claim of clinical validation without external validation

### E. UI / scenario runtime

The clinical UI should become patient-first rather than preset-first.

Required sequence:

1. select a synthetic patient
2. review presenting clinical data and provenance
3. inspect current ventilator settings and waveforms
4. make a ventilator/intervention change
5. advance time
6. observe pulmonary + systemic response
7. perform measurements/maneuvers
8. review a timeline/replay of decisions and physiologic consequences

The user should be able to see which outputs are measured/model-derived, HumMod-derived, cohort targets, or assumptions.

### F. Evidence and provenance

Keep evidence metadata close to the model configuration, not only in the manuscript. The initial Berlin cohort envelopes currently reference:

- ARDS Definition Task Force, JAMA 2012 — Berlin definition
- Huang et al., Critical Care 2020 — Berlin-stratified ventilation/mechanics cohort calibration
- Bellani et al., JAMA 2016 — LUNG SAFE real-world benchmark
- Chen et al., AJRCCM 2020 — recruitment-to-inflation/recruitability physiology

Future additions must record exact source, version/date when relevant, and what the source is being used to justify.

## 5. Milestones

### Milestone 0.5A — clinical case foundation

- [x] Berlin cohort envelopes separated from recruitability presets
- [x] persistent PEEP-setting changes and intervention log foundation
- [x] source-neutral digital-twin snapshot contract
- [ ] nine explicit named synthetic Berlin cases
- [ ] tests for case matrix/provenance
- [ ] case catalog exported to browser build

### Milestone 0.5B — HumMod bridge

- [ ] explicit HumMod snapshot mapper
- [ ] mapper unit tests
- [ ] document exact HumMod source revision and mapped variables
- [ ] deterministic replay provider
- [ ] one end-to-end case carrying HumMod systemic snapshots

### Milestone 0.5C — clinically trustworthy bedside mechanics

- [ ] inspiratory hold
- [ ] expiratory hold
- [ ] total/intrinsic PEEP measurement
- [ ] plateau measurement
- [ ] driving-pressure measurement
- [ ] waveform measurement annotations
- [ ] regression cases for obstructive/high-resistance dynamics

### Milestone 0.5D — coupled physiology

- [ ] define lung-to-HumMod inputs
- [ ] define HumMod-to-lung inputs
- [ ] explicit time-step ownership and synchronization
- [ ] gas exchange/acid-base ownership decision
- [ ] systemic hemodynamic response visible in UI
- [ ] fluid/renal/metabolic state available for scenarios

### Milestone 0.5E — scenario UX and validation harness

- [ ] patient selector
- [ ] timeline/event log
- [ ] intervention replay
- [ ] desktop and mobile layouts
- [ ] reference-case regression suite
- [ ] external physiologic benchmark report

## 6. Initial nine-case design

The nine baseline cases use Berlin severity as one axis and recruitability as the second. Etiology is scenario metadata, not a claim that a particular etiology determines a Berlin grade or recruitability phenotype.

| Berlin severity | Low recruitability | Moderate recruitability | High recruitability |
| --- | --- | --- | --- |
| Mild | focal pneumonia scenario | aspiration scenario | extrapulmonary inflammatory scenario |
| Moderate | focal pneumonia scenario | aspiration scenario | extrapulmonary sepsis scenario |
| Severe | focal pneumonia / preserved-mechanics variant | aspiration / intermediate-mechanics variant | diffuse inflammatory / high-recruitability variant |

The table is intentionally a scenario matrix, not a clinical taxonomy. The code must label those etiology/mechanics pairings as synthetic authoring choices.

## 7. HumMod technical strategy

The public `riliescu/hummod-standalone` repository currently exposes a structured model hierarchy (`Context`, `Control`, `Display`, `Docs`, `Structure`), root model description files such as `HumMod.DES` / `Model.DES`, and a Windows executable. That packaging makes direct execution inside a static browser build inappropriate, but it does **not** preclude HumMod integration.

The build therefore targets two provider modes:

- **replay provider:** browser consumes previously exported, versioned HumMod state trajectories
- **live provider:** a service hosts the HumMod runtime and exchanges normalized snapshots/interventions with the browser app

Before distributing HumMod files or embedding its runtime in this project, verify the applicable upstream licensing/permission terms for the exact components being used. Do not vendor the HumMod executable or model files into this repository merely for convenience.

## 8. Verification policy

A feature is not considered complete merely because the UI renders.

For each physiology feature:

1. deterministic unit test
2. edge-case / failure-mode test
3. reference-case test
4. source/provenance check
5. build/browser smoke test
6. clinical plausibility review

Automated tests must never be described as external clinical validation.

## 9. Documentation policy

All substantive work on this effort is documented in this repository:

- this file: architecture, milestones and acceptance criteria
- `docs/WORKLOG.md`: append-only implementation history and verification status
- `docs/HUMMOD_INTEGRATION.md`: HumMod-specific mapping/runtime decisions
- source comments: local implementation constraints and provenance where needed
- tests: executable acceptance criteria

If a design decision changes, update the build plan and work log in the same branch as the implementation change.


## 10. Autonomic, respiratory-control, and sepsis physiology modernization — 2026-10-10

The project now has a formal evidence-first controller program. The detailed implementation and validation specification is in `docs/AUTONOMIC_RESPIRATORY_SEPSIS_ROADMAP.md`.

Key decisions:

- All physiologic gains, transfer functions, thresholds, mappings, time constants, saturation limits, and other physiologic parameters require explicit published medical/physiologic provenance. Source, equation or parameter basis, units, intended effect, and any HumMod/Vent transformation must be documented. The previously tested linear PaO2-to-`SympsChemo.Effect` extension remains inactive because it does not meet this requirement.
- Ursino/Magosso is the primary source family for peripheral O2/CO2 chemoreflex, CNS hypoxia/CO2 effects, lung-stretch feedback, separate autonomic channels, and candidate heart-period control.
- Hennigs et al. 2026 is the respiratory-center/patient-ventilator interaction track and will be integrated in shadow mode before controller activation.
- The complete autonomic controller must run in shadow mode before it can own any live effector.
- HumMod versus Ursino SA-node/heart-period ownership remains an explicit validation question.
- Existing DO2, tissue-O2, and organ redistribution logic is protected; it is not replaced as an HR workaround.
- Yamanaka sepsis physiology is a later disease-state layer. Foteinou/Scheff autonomic-inflammatory coupling follows in shadow mode.
- Aortic CaO2-content chemoreflex and fever chronotropy remain on hold until source-backed quantitative equations are established.

No physiology implementation is considered ready merely because a plausible response can be produced. Empirical or fitted relationships are permitted only when the fitting method, source data, rationale, and independent validation are documented. No physiologic gain or mapping may be introduced solely to produce a desired simulation response.


## 11. v1.5 execution status — first five physiology steps

- [x] Build Ursino/Magosso equation transcription ledger.
- [x] Record equation identifiers, primary citations, units, parameters, intended effects, and project mappings.
- [x] Implement Phases 1-3 as a non-authoritative Ursino/Magosso shadow controller.
- [x] Couple the published pulmonary stretch-receptor equation to actual Vent delivered tidal volume.
- [x] Complete the Magosso/Ursino 2001 CO2 parameter audit.

### Provenance blockers retained

- 2001 peripheral O2-CO2 Eq. 1 remains inactive until the printed piecewise interaction coefficient is visually verified from the primary article.
- Ursino `f_ab` remains unmapped because HumMod `Baroreflex.NA` has not been proven equivalent to baroreceptor afferent firing in spikes/s.
- Consequently, `f_sp`, `f_sh`, and `f_v` are implemented as source-faithful functions but are not driven from HumMod baroreflex state.
- No new controller output has live authority over HR, SVR, venous tone, or SA-node behavior.


## 12. v1.5 Step 6 — autonomic shadow validation

- [x] Added repeatable `shadow:v1.5-autonomic` perturbation harness.
- [x] Replayed published Ursino/Magosso O2/CNS-hypoxia shadow states against the 157-sample native HumMod run07 trajectory.
- [x] Corrected lung-stretch coupling to use last-completed-breath measured `VtInspired`.
- [x] Recorded native-vs-shadow comparison artifact.
- [x] Kept all shadow outputs non-authoritative.

Result: strong concordance between published Ursino peripheral O2 chemoreceptor response and native HumMod chemoreceptor response before CNS failure, but much smaller native downstream SympsCNS/SA-node activation. This is an architecture finding, not justification for an empirical HR correction.

Activation remains blocked by:
1. no source-valid HumMod-to-Ursino `f_ab` mapping;
2. unverified printed Magosso/Ursino 2001 Eq. 1 O2-CO2 piecewise coefficient;
3. incomplete full efferent native comparison.

See `docs/V1_5_AUTONOMIC_SHADOW_VALIDATION.md` and `artifacts/v1.5/V1_5_NATIVE_URSINO_SHADOW_COMPARISON.json`.


## 13. v1.5 Steps 7-16 — execution status

See `docs/V1_5_NEXT_10_STEPS_EXECUTION.md`.

- [x] Published arterial-pressure -> Ursino baroreceptor afferent `f_ab` shadow.
- [x] Full `f_ab/f_ac/f_ap/theta_sp/theta_sh/f_sp/f_sh/f_v` shadow chain.
- [x] Full-chain non-authority/provenance test guards added.
- [x] SA-node vs Ursino heart-period ownership audit + fail-closed contract.
- [x] DO2/tissue-O2 regression guard.
- [x] Hennigs respiratory-center interface + fail-closed contract.
- [x] Yamanaka sepsis equation ledger + parameterized disease-layer shadow functions.
- [x] Foteinou/Scheff inflammation-autonomic audit + fail-closed contract.
- [x] Sympathetic fatigue reclassified as source-backed Yamanaka candidate; remains disease-layer shadow only.
- [x] CaO2-content chemoreflex and fever chronotropy formalized as HOLD items.

**No new physiologic controller has been activated.** The principal unresolved autonomic blocker is still the exact Magosso/Ursino 2001 Eq. 1 peripheral O2-CO2 interaction transcription. The Ursino heart-period effector also remains blocked pending complete primary-source parameter transcription.


## 14. v1.5 Steps 17-26 — oxygen-delivery modernization

- [x] Add Cain/Schumacker foundational DO2-VO2 physiology to the literature hierarchy.
- [x] Add human critical-illness evidence to prevent universal transfer of animal DO2crit values.
- [x] Add Cheng/Albanese/Ursino integrated-model validation as the implementation anchor.
- [x] Add modern microcirculatory oxygen-transport literature.
- [x] Reclassify the 15-mmHg venous PO2 floor as a provisional engineering boundary without silently changing behavior.
- [x] Add a machine-readable oxygen-delivery evidence registry and provenance guard.
- [x] Add regional oxygen-transport audit functions without universal critical thresholds.
- [x] Add fail-closed microcirculation and sepsis extraction contracts.
- [x] Make oxygen-debt/collapse calibration provenance explicit.
- [x] Add a mechanism-separated oxygen-transport shadow harness and synchronize the roadmap.

No new oxygen-delivery threshold has been activated. No Cain animal threshold is used as a universal patient cutoff.
