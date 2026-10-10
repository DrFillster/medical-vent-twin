# Autonomic, Respiratory-Control, and Sepsis Physiology Roadmap

Status: evidence-first implementation plan  
Date: 2026-10-10  
Applies to: `DrFillster/medical-vent-twin` and `DrFillster/hummod-vent-core`

## Purpose

Replace ad hoc physiologic corrections with source-traceable controller equations while preserving HumMod as the integrated whole-body physiology plant where its existing physiology is suitable.

The immediate problem is not to force tachycardia. The goal is to reproduce the coupled physiology that can generate tachycardia, bradycardia, vasoconstriction, vasodilation, altered cardiac output, respiratory drive, and eventual decompensation from the modeled state.

The recently tested linear PaO2-to-`SympsChemo.Effect` extension is not an accepted physiologic solution and must remain inactive. No direct empirical heart-rate gain should be reintroduced.

## Architecture

Three coupled layers will be developed:

1. **Cardiovascular/autonomic controller — Ursino/Magosso family**
   - baroreflex integration;
   - peripheral O2/CO2 chemoreflex;
   - CNS hypoxia and CO2 effects;
   - lung-stretch feedback;
   - separate cardiac sympathetic, vascular sympathetic, and vagal channels;
   - candidate heart-period effector.

2. **Respiratory-center controller — Hennigs et al. 2026, supported by Ursino ventilatory-control work**
   - chemical feedback;
   - mechanical feedback;
   - reflex mechanisms;
   - spontaneous respiratory drive;
   - patient effort;
   - patient-ventilator interaction and asynchrony.

3. **Critical-illness modifier — Yamanaka + Foteinou/Scheff**
   - inflammation;
   - vascular permeability/capillary leak;
   - vasodilation/vasoplegia;
   - myocardial depression;
   - autonomic and neuroendocrine modulation;
   - later sympathetic fatigue/desensitization if supported and validated.

### Ownership principle

Vent owns high-resolution ventilator mechanics, actual delivered VT, pressure/flow/volume waveforms, recruitment/derecruitment, holds, and patient-ventilator mechanics.

HumMod remains the systemic plant and retains DO2, tissue oxygen use, organ blood-flow redistribution, fluid/renal/endocrine physiology, acid-base, and other validated whole-body state unless a specific ownership cutover is justified.

Published controller modules may generate missing control signals, but they must not silently replace downstream HumMod effectors before shadow validation.

## Implementation gate for every equation

No controller equation becomes active until all of the following exist:

1. exact primary source citation;
2. source page, equation, figure, or parameter-table location where available;
3. complete parameter transcription with units;
4. explicit input/output variable map to Vent/HumMod;
5. provenance status: native HumMod, exact external-source transcription, calibrated extension, or hypothesis;
6. deterministic unit tests;
7. shadow-mode comparison against current HumMod;
8. reference perturbation tests for direction, timing, magnitude, saturation, and recovery;
9. no unexplained regression in DO2, tissue oxygen, hemodynamics, or ventilator behavior;
10. explicit activation decision.

## Phase roadmap

### Phase 1 — Ursino peripheral O2 chemoreceptor
**Status: implement-ready after exact equation/parameter transcription into the code specification.**

Implement the source model rather than a linear PaO2 gain. The controller must preserve the published dependence on arterial oxygen state and the model's interaction with CO2 where the selected formulation includes it.

Expected role:

`arterial O2 state -> peripheral chemoreceptor afferent drive -> autonomic integration`

Do not connect this directly to heart rate.

Primary sources:
- Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia. I. A mathematical model. Am J Physiol Heart Circ Physiol. 2000;279:H149-H165. DOI: 10.1152/ajpheart.2000.279.1.H149. PMID: 10899052.
- Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia. II. Model validation. Am J Physiol Heart Circ Physiol. 2000;279:H166-H175. DOI: 10.1152/ajpheart.2000.279.1.H166. PMID: 10899053.

### Phase 2 — Cardiac and vascular CNS hypoxia offsets
**Status: implement-ready after exact source transcription.**

Keep central hypoxia distinct from peripheral chemoreceptor signaling. Implement the published cardiac and vascular CNS hypoxia offsets as separate terms, conceptually:

`theta_sh = F(brain O2 state)`

`theta_sp = F(brain O2 state)`

The exact independent variable, thresholds, gains, saturations, and dynamics must come from the cited source. Do not infer them from the current HumMod display scale.

Purpose: allow severe/deep hypoxia to modify cardiac and vascular autonomic control through the CNS pathway rather than forcing all O2 effects through a single peripheral chemoreflex.

Source: Ursino & Magosso 2000 I/II above.

### Phase 3 — Separate autonomic channels
**Status: implement-ready.**

Expose and preserve distinct controller outputs:

- `f_sh`: cardiac sympathetic;
- `f_sp`: peripheral/arteriolar sympathetic;
- `f_v`: cardiac vagal.

If the exact selected source formulation also requires a distinct venous sympathetic channel, add it only after source verification.

These channels must not be collapsed into one generic sympathetic multiplier. They will feed the appropriate downstream HumMod or candidate Ursino effectors in shadow mode.

### Phase 4 — Lung-stretch receptor coupling to actual Vent VT
**Status: implement-ready after exact source transcription.**

Use actual Vent-delivered/measured lung inflation rather than estimating VT from blood gases.

The published controller uses a dynamic lung-stretch afferent form equivalent in structure to a first-order response driven by tidal volume. The exact equation, gain, time constant, definition of VT, and units must be transcribed from the primary source before implementation.

Coupling:

`Vent actual VT -> lung-stretch afferent -> autonomic controller`

This is a critical heart-lung feedback path and must operate for controlled and spontaneous/assisted ventilation.

### Phase 5 — Hypercapnia, O2-CO2 interaction, and CNS CO2
**Status: implement-ready after full parameter audit.**

Implement the Magosso/Ursino CO2 pathways as a coordinated subsystem, not an isolated PaCO2-to-HR term.

Required mechanisms from the source model include:
- O2-CO2 interaction at peripheral chemoreceptors;
- local CO2 effects on vascular resistance;
- direct CNS cardiovascular response to CO2;
- central chemoreceptor effects on ventilation/VT.

Primary source:
- Magosso E, Ursino M. A mathematical model of CO2 effect on cardiovascular regulation. Am J Physiol Heart Circ Physiol. 2001;281:H2036-H2052. DOI: 10.1152/ajpheart.2001.281.5.H2036. PMID: 11668065.

Respiratory-control companion sources:
- Ursino M, Magosso E, Avanzolini G. An integrated model of the human ventilatory control system: the response to hypercapnia. Clin Physiol. 2001;21:447-464. DOI: 10.1046/j.1365-2281.2001.00349.x. PMID: 11442578.
- The paired hypoxia paper should be transcribed and cited from the primary paper before its equations are implemented.

### Respiratory companion track — Hennigs respiratory-center model
**Status: source-audit and interface-design phase; target shadow integration before autonomic activation.**

Hennigs et al. is the preferred modern starting point for the respiratory-center layer because it explicitly joins chemical feedback, mechanical feedback, reflex mechanisms, spontaneous breathing, and ventilator interaction.

Target interface:

`O2/CO2 chemical drive + mechanical/reflex feedback -> neural respiratory drive/patient effort -> Vent mechanics -> actual VT/flow/pressure -> gas exchange and lung-stretch feedback`

Required work:
1. transcribe the Hennigs state equations and all parameters from the primary article/supplement;
2. identify which variables overlap with the Ursino ventilatory controller and avoid double authority;
3. define a single owner for respiratory neural drive;
4. map patient effort to the Vent engine;
5. reproduce the paper's hypoxia, hypercapnia, pressure-support, and asynchrony validation conditions before activation.

Primary source:
- Hennigs C, Bilda F, Selpien H, Lerg T, Männel G, Becher T, Schädler D, Rostalski P. Patient-ventilator interaction—Development of a mathematical model of the respiratory center. Comput Methods Programs Biomed. 2026;280:109329. DOI: 10.1016/j.cmpb.2026.109329. PMID: 41905158.

### Phase 6 — Full autonomic controller in shadow mode
**Status: mandatory before activation.**

The new controller runs from the same physiologic inputs as the live simulation but cannot change the authoritative patient state.

Record at each time step:
- baroreceptor input;
- peripheral chemoreceptor input;
- lung-stretch input;
- CNS hypoxia/CO2 terms;
- `f_sh`, `f_sp`, `f_v`;
- current HumMod sympathetic/vagal outputs;
- candidate downstream effectors;
- HR, SV, CO, SVR, venous state, PaO2, PaCO2, pH, brain/tissue O2, DO2.

Required perturbations:
1. normoxia/normocapnia baseline;
2. isolated isocapnic hypoxia;
3. isolated hypercapnia;
4. combined hypoxic hypercapnia;
5. changing VT/lung inflation at matched gases;
6. ventilator support changes;
7. spontaneous/assisted breathing after the respiratory-center track is available;
8. recovery to baseline.

Activation requires clinically and source-consistent direction, time course, interaction, and stability. It does not require numerical identity with the current HumMod controller.

### Phase 7 — SA-node ownership: HumMod vs Ursino heart-period equations
**Status: requires validation; no current cutover.**

Compare two downstream alternatives using the same controller inputs:

A. current HumMod SA-node/heart-rate effector;  
B. Ursino heart-period model with distinct sympathetic and vagal effects and source-defined delays/dynamics.

Do not select the model based on which one creates a desired tachycardia. Select it based on fidelity across the full perturbation suite.

Supporting source:
- Ursino M, Magosso E. Role of short-term cardiovascular regulation in heart period variability: a modeling study. Am J Physiol Heart Circ Physiol. 2003;284:H1479-H1493. DOI: 10.1152/ajpheart.00850.2002. PMID: 12595291.

### Phase 8 — Preserve DO2, tissue O2, and organ redistribution
**Status: already conceptually correct; protect with regression tests.**

Do not replace the existing whole-body oxygen-delivery accounting merely to repair HR.

Preserve:
- cardiac-output contribution to oxygen delivery;
- arterial oxygen-content contribution;
- tissue oxygen extraction/use;
- organ-specific perfusion/redistribution;
- brain and myocardial priority behavior where represented.

Use the controller work to alter the upstream hemodynamic/autonomic state, then allow systemic oxygen transport to respond.

Validation anchor:
- Cheng L, Albanese A, Ursino M, Chbat NW. An integrated mathematical model of the human cardiopulmonary system: model validation under hypercapnia and hypoxia. Am J Physiol Heart Circ Physiol. 2016;310:H922-H937. DOI: 10.1152/ajpheart.00923.2014. PMID: 26747507.
- Albanese A, Cheng L, Ursino M, Chbat NW. An integrated mathematical model of the human cardiopulmonary system: model development. Am J Physiol Heart Circ Physiol. 2016. DOI: 10.1152/ajpheart.00230.2014. PMID: 26683899.

### Phase 9 — Yamanaka sepsis state
**Status: candidate disease layer after normal autonomic physiology is validated.**

Add inflammation as a disease-state modifier capable of producing source-supported effects on:
- vascular permeability / intravascular volume loss;
- vascular tone;
- cardiac performance;
- other explicitly modeled Yamanaka mechanisms after full equation audit.

Do not use sepsis parameters to compensate for deficiencies in the normal controller.

Source:
- Yamanaka Y et al. Mathematical modeling of septic shock based on clinical data. Theor Biol Med Model. 2019;16:5. DOI: 10.1186/s12976-019-0101-9. PMID: 30841902.

### Phase 10 — Foteinou/Scheff inflammation-autonomic dynamics
**Status: candidate; shadow mode first.**

Evaluate inflammatory/neuroendocrine/autonomic coupling as an additional layer over the validated normal controller and initial sepsis model.

Sources:
- Foteinou PT et al. Multiscale model for the assessment of autonomic dysfunction in human endotoxemia. Physiol Genomics. 2010;42:5-19. DOI: 10.1152/physiolgenomics.00184.2009. PMID: 20233835.
- Scheff JD et al. Modeling autonomic regulation of cardiac function and heart rate variability in human endotoxemia. Physiol Genomics. 2011;43:951-964. DOI: 10.1152/physiolgenomics.00040.2011. PMID: 21673075.

### Phase 11 — Sympathetic fatigue/desensitization
**Status: candidate only after sepsis validation.**

Do not add an empirical fatigue term now. First determine whether the validated Yamanaka/Foteinou/Scheff implementation already produces the required late autonomic behavior. Add a separate fatigue/desensitization state only if a source-backed equation is identified and an unmet validation requirement remains.

### Phase 12 — Aortic CaO2-content chemoreflex
**Status: HOLD.**

Physiologic plausibility is not sufficient. No implementation until a suitable quantitative equation and parameters are established from a primary source and the relationship to the existing O2 chemoreceptor controller is defined.

### Phase 13 — Temperature/fever chronotropy
**Status: HOLD.**

Do not add a temperature-to-HR correction. Implement only after a source-backed dynamic equation is selected and interactions with autonomic, metabolic, and sepsis state are defined.

## Validation strategy

The controller program must be validated as a system.

### Stage A — equation fidelity
- exact equation transcription;
- parameter and unit audit;
- steady-state checks;
- dynamic/time-constant checks;
- saturation/limit checks.

### Stage B — isolated subsystem perturbations
- O2 only;
- CO2 only;
- combined O2 + CO2;
- baroreflex perturbation;
- lung inflation/VT perturbation.

### Stage C — integrated shadow runs
Compare candidate controller vs current HumMod while keeping current HumMod authoritative.

### Stage D — respiratory integration
Add Hennigs patient effort and reproduce source conditions for hypoxia, hypercapnia, pressure support, and asynchrony.

### Stage E — controlled activation
Activate one ownership boundary at a time. Maintain rollback and provenance.

### Stage F — disease-state expansion
Only after normal physiology passes: Yamanaka sepsis -> Foteinou/Scheff autonomic-inflammatory coupling -> candidate fatigue.

## Repository responsibility

### hummod-vent-core
Owns:
- exact literature equation/parameter transcriptions;
- official HumMod symbol mapping;
- source provenance;
- shadow autonomic controller;
- controller validation harness;
- native HumMod comparison data;
- activation recommendations.

### medical-vent-twin
Owns:
- Vent actual VT and ventilator mechanics;
- respiratory effort/ventilator interaction interface;
- integrated scenario runtime;
- shadow-vs-live diagnostics in the product;
- DO2/tissue-O2 regression protection;
- user-facing provenance;
- final subsystem activation after validation.

## Immediate next work

1. Build the equation transcription ledger for Ursino/Magosso 2000 and 2001.
2. Record exact equation numbers, parameter tables, units, source pages, and variable definitions.
3. Implement Phases 1-3 as non-authoritative controller modules.
4. Complete the Phase 4 lung-stretch transcription and connect it to actual Vent VT in shadow mode.
5. Complete the CO2 parameter audit.
6. In parallel, transcribe the Hennigs respiratory-center equations and define the Vent effort interface.
7. Run the integrated controller in shadow mode.
8. Only then evaluate SA-node ownership and activation.

## Prohibited shortcuts

- no direct PaO2 -> HR gain;
- no direct PaCO2 -> HR gain;
- no invented `SympsChemo.Effect` transfer function;
- no parameter tuning solely to make HR exceed a target;
- no activation before shadow validation;
- no sepsis layer used to repair normal physiology;
- no fever or CaO2 chemoreflex implementation without a source equation;
- no replacement of DO2/tissue-O2 accounting without independent justification.
