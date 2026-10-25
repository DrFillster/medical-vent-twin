# v1.0 Physiology Recovery Plan

## Objective
Use the v1.0 bedside simulator and UI as the baseline. Do not add complexity unless it corrects a demonstrated physiologic gap. Every replacement mechanism must have explicit provenance, units, assumptions, domain, and validation criteria.

## Guardrails
- Planning/audit only until physician approval to implement.
- Preserve v1.0 bedside workflow and UI unless a change is necessary for physiology.
- Do not transplant the v1.8 architecture into v1.0.
- Do not add arbitrary caps, gains, death timers, or "looks right" tuning.
- Prefer published equations or clearly labeled bounded surrogates.
- Separate clinical-behavior validation from code/test infrastructure.
- Save large logs and evidence to Vent Drive. Do not accumulate local Mac logs.

## Work chunks

### Chunk 1 — Baseline inventory
Status: IN PROGRESS

Goal:
Identify exactly what v1.0 computes, what is scripted, what is coupled, and what is absent.

Inspect:
- release/v1.0
- product/v1.0-clinical-twin
- release/v1.0-arrest-capable
- fix/v1.0-extremis-demo
- feature/v1.0-terminal-demo
- feature/v1.0-terminal-demo-v2

Deliverable:
A component inventory with:
- variable/output
- current v1.0 equation or rule
- source/provenance
- missing dependency
- whether replacement is required

Stop condition:
No implementation.

### Chunk 2 — Cardiovascular control
Status: NOT STARTED

Audit gaps:
- HR response to hypoxemia
- HR response to hypercapnia
- HR response to acidemia
- HR response to sepsis/hemorrhage
- stroke volume and preload/afterload coupling
- SVR regulation
- cardiac output
- compensatory limits

Replacement standard:
Use sourced autonomic/baroreflex/chemoreflex and ventricular-performance relationships only where v1.0 lacks a defensible mechanism.

Clinical validation targets:
- physiologic tachycardia during severe hypoxia/shock
- falling SVR in distributive shock
- loss of compensation in severe deterioration
- no persistent implausible MAP preservation

### Chunk 3 — Oxygen delivery and tissue hypoxia
Status: NOT STARTED

Audit gaps:
- CaO2 calculation
- DO2 = CaO2 x CO
- extraction reserve
- tissue oxygen availability
- critical delivery behavior
- organ-level consequences of sustained inadequate delivery

Replacement standard:
Build the smallest defensible oxygen-delivery chain needed to link gas exchange and circulation to systemic deterioration.

Clinical validation targets:
- worsening oxygen delivery when SaO2/Hb/CO fall
- finite compensatory reserve
- progressive organ failure when delivery remains inadequate

### Chunk 4 — Acid-base and CO2 coupling
Status: NOT STARTED

Audit gaps:
- respiratory acidosis
- metabolic acidosis
- pH effect on HR/autonomic response
- pH effect on vascular tone
- CO2 effect on autonomic response
- interaction with pulmonary vascular resistance

Replacement standard:
Use established acid-base relationships and sourced physiologic response functions. Avoid independent hand-tuned multipliers for pH/CO2.

Clinical validation targets:
- severe hypercapnia/acidemia causes meaningful cardiovascular consequences
- compensation does not remain indefinitely effective

### Chunk 5 — Pulmonary circulation / RV / ventilator-hemodynamic coupling
Status: NOT STARTED

Audit gaps:
- hypoxic pulmonary vasoconstriction
- acidosis-related PVR change
- airway-pressure/PEEP effect on venous return
- RV afterload
- RV failure progression
- effect on LV filling and systemic output

Replacement standard:
Add only mechanisms needed to reproduce clinically relevant ARDS/PEEP hemodynamics.

Clinical validation targets:
- PVR rises appropriately with severe hypoxia/acidemia
- high PEEP can reduce venous return and/or worsen RV load
- severe RV compromise can reduce systemic output

### Chunk 6 — Sepsis/distributive physiology
Status: NOT STARTED

Audit gaps:
- vasodilation
- capillary leak/effective circulating volume
- inflammatory myocardial depression
- autonomic compensation
- loss of compensation

Replacement standard:
Use sourced mechanisms from validated sepsis/inflammation models when feasible. If a reduced-order surrogate is necessary, document it explicitly and keep its domain narrow.

Clinical validation targets:
- early compensation possible
- SVR falls
- tachycardia occurs
- severe disease can progress to low-flow shock and collapse

### Chunk 7 — Terminal physiology and arrest
Status: NOT STARTED

Audit:
Review all v1.0 arrest/extremis/terminal branches before deciding what to retain.

Required principle:
The patient must not die because a timer expires.

Terminal state should emerge from sustained physiologic failure such as:
- inadequate systemic perfusion/oxygen delivery
- severe circulatory collapse
- incompatible acid-base state
- arrest rhythm/state or equivalent terminal physiology

Deliverable:
A proposed terminal-state state machine with every transition tied to physiologic variables and sourced thresholds or clearly labeled model assumptions.

### Chunk 8 — Renal/metabolic and longer-timescale physiology
Status: DEFERRED

Question:
Which mechanisms materially affect the short bedside scenarios?

Default:
Do not import large HumMod renal/metabolic subsystems unless a missing mechanism changes clinically relevant short-run behavior.

Possible later scope:
- potassium
- lactate
- renal perfusion
- urine output
- glucose
- slower fluid/electrolyte shifts

## Validation approach
After the audit, create a small fixed scenario set and use the same initial conditions across versions/mechanisms:
- isolated hypoxemia
- hypercapnia/acidemia
- distributive shock
- hemorrhagic/low-preload shock
- high-PEEP/RV stress
- combined severe ARDS + shock
- terminal/extremis scenario

For each scenario record:
- HR
- MAP
- SVR
- PVR
- stroke volume
- cardiac output
- PaO2
- PaCO2
- pH
- CaO2
- DO2
- relevant tissue/terminal-state variables

## Decision rule for adding physiology
A mechanism is added only if:
1. v1.0 has a demonstrated clinical gap.
2. The mechanism can be sourced or explicitly bounded as a surrogate.
3. It improves the relevant clinical behavior without breaking previously accepted behavior.
4. The physician review accepts the result as clinically plausible.

## Current planning conclusion
The current preferred architecture is:
v1.0 bedside behavior/UI + explicit defensible physiology + selective complexity.

Do not implement until this audit is complete and physician approval is given.


## Chunk 1 findings — baseline v1.0 physiology inventory
Status: SUBSTANTIALLY COMPLETE

### What v1.0 already has
The v1.0 engine is not a purely mechanical simulator. It already includes a reduced cardiopulmonary model with:
- explicit systemic arterial/venous, right atrial, pulmonary arterial/capillary/venous, and left atrial volume compartments
- source-aligned HumMod pressure-volume, conductance-flow, and ventricular pump primitives
- cardiac output and stroke-volume generation from the reduced circulation
- ventilator -> thoracic pressure -> circulation coupling
- gas exchange with arterial/venous O2 content, PaO2, PaCO2, pH, saturation, and HCO3 state
- Fick-style oxygen extraction coupled to cardiac output
- an oxygen-supply-deficit variable when requested aerobic demand exceeds modeled delivery
- a bounded hypercapnic-acidosis response anchored to Stengl et al. 2013
- a reduced autonomic controller that changes HR, contractility, systemic arterial conductance, venous unstressed volume, and pulmonary conductance
- explicit SVR and PVR outputs
- preserved bedside ventilator mechanics, recruitment state, holds, plateau pressure, total/intrinsic PEEP, and driving pressure

### Key structural reductions already documented in code
1. Full organ/splanchnic circulation is collapsed into one systemic arterial runoff plus systemic venous reservoir.
2. Tissue metabolic demand is supplied as a boundary rather than generated by organ metabolism.
3. Gas runtime does not include organ-specific extraction, lactate kinetics, mitochondrial failure, or full metabolic compensation.
4. Native HumMod endocrine/autonomic systems such as catecholamines, nerves, renin, ADH, aldosterone, and ANP are not part of the acute reduced core.
5. Hemorrhage, transfusion, IV drip, CPR, renal, glucose, endocrine, and many longer-timescale systems are outside the acute core.
6. The reduced model is explicitly marked in code as not clinically validated.

### Most important defendability problem found
The largest problem is not that v1.0 lacks all hemodynamic physiology. It is that several control relationships are engineering gains rather than clearly sourced physiologic equations.

Examples in the current autonomic controller include:
- MAP target = 82 mmHg
- baroreflex gain = 0.035
- hypoxic sympathetic contribution = 0.18 * hypoxicDrive
- hypercapnic sympathetic contribution = 0.10 * hypercapnicDrive
- HR target includes +55 * sympatheticTone and -22 * parasympatheticTone
- contractility target uses 0.88 + 0.72 * catecholamineDrive
- systemic conductance uses denominator 0.86 + 1.45 * sympatheticTone
- venous unstressed volume falls by 14% * sympatheticTone
- pulmonary load includes 0.018 * positive thoracic pressure + 0.28 * hypoxicDrive

These terms are transparent and bounded, but most are not yet linked to authoritative equations. They are therefore prime replacement targets if the goal is to make v1.0 assumptions defensible without increasing architecture complexity.

### Important physiology that should be retained, not replaced reflexively
- The reduced volume-based circulation architecture is useful and understandable.
- Ventilator-to-thoracic-pressure coupling should be retained.
- The Fick-style oxygen-delivery chain should be retained.
- The 15 mmHg critical venous/capillary PO2 transition is explicitly sourced in the manuscript and can remain provisionally while its exact applicability is audited.
- The Stengl hypercapnic-acidosis anchor is explicitly identified as an experimental anchor and should remain a validation datum, not be generalized beyond its domain.
- The respiratory mechanics/recruitment/UI layer remains the preferred v1.0 chassis.

### Critical missing physiology confirmed
1. No explicit sepsis/inflammation state drives vasodilation, capillary leak, or myocardial depression. A case can be labeled sepsis without true systemic sepsis physiology.
2. No explicit hemorrhage/blood-volume loss pathway is active in the reduced acute core.
3. No lactate/anaerobic-metabolism state converts persistent oxygen-supply deficit into progressive metabolic acidosis and organ dysfunction.
4. No organ-specific hypoperfusion or failure state exists.
5. No explicit terminal/arrest physiology is present in the core engine. The arrest/extremis/terminal branch names inspected currently point to the same core engine blob as release/v1.0, so any demo behavior must be elsewhere or branch scaffolding rather than a distinct core physiology implementation.
6. Compensation can therefore remain mathematically active without a physiologic exhaustion/failure pathway.
7. There is no sourced mechanism yet for transition from prolonged inadequate DO2 / severe acidemia / low flow to myocardial depression, loss of vascular responsiveness, electrical instability, or arrest.

### Revised priority after Chunk 1
The minimum-defensible replacement sequence should be:
1. Replace unsourced autonomic/baroreflex/chemoreflex gains with sourced reduced equations.
2. Add a minimal sepsis/distributive module only if sepsis scenarios are required.
3. Add oxygen-debt / anaerobic-metabolism consequences so oxygen-supply deficit changes physiology rather than remaining only a reported deficit.
4. Add myocardial depression / vascular failure pathways driven by severe hypoxia, acidemia, and/or sepsis using sourced relationships.
5. Define terminal-state transitions from physiologic failure, not timers.
6. Defer renal/endocrine complexity unless required for the scenario time horizon.

### Chunk 1 conclusion
The v1.0 architecture is a viable chassis. The main scientific weakness is not absence of all physiology; it is that the acute feedback controller contains several explicit engineering gains and lacks downstream failure physiology. The preferred strategy is therefore to replace those gains and add only the missing failure pathways, rather than importing the full v1.8/HumMod architecture.


## Chunk 2 findings — cardiovascular control
Status: AUDIT COMPLETE / REPLACEMENT DESIGN READY

### Finding
v1.0 already has the correct high-level control structure for a reduced bedside model: circulation -> MAP -> autonomic response -> HR/contractility/vascular tone -> circulation. The problem is that several links are represented by local engineering gains rather than a published physiologic controller.

The current controller uses a fixed MAP operating target of 82 mmHg and explicit gains for pressure error, hypoxia, hypercapnia, HR, contractility, systemic conductance, venous unstressed volume, and pulmonary conductance. These are transparent, but they are not a defensible substitute for a published integrated baroreflex/chemoreflex model.

### Replacement A — short-term arterial pressure control
Preferred source family:
- Ursino, "Modelling the interaction among several mechanisms in the short-term arterial pressure control" (2000).
- Ursino, "A mathematical model of the carotid baroregulation in pulsating conditions" (1999).

Design:
- Retain the v1.0 six-compartment-style reduced circulation where practical.
- Replace the fixed linear MAP-error controller with a reduced form of the published baroreceptor -> central integration -> sympathetic/vagal -> effector pathway.
- Preserve the four clinically useful effectors: heart period/HR, systemic peripheral resistance, systemic venous unstressed volume, and contractility.
- Use the published parameter set or a traceable reduction of it. Do not fit new gains to make the monitor look correct.

Why:
The Ursino model explicitly represents baroreceptors, sympathetic and vagal activity, and the same four effectors. It also reports satisfactory agreement with experimental behavior. fileciteturn1file10 fileciteturn1file12

### Replacement B — hypoxic chemoreflex
Preferred source:
- Ursino & Magosso, acute cardiovascular response to isocapnic hypoxia (2000), including peripheral chemoreceptors, baroreceptors, lung stretch receptors, and CNS hypoxic response.
- Magosso/Ursino integrated respiratory-control work for the chemoreflex pathway.

Design:
- Do not simply add a larger positive HR multiplier when PaO2 falls.
- Represent the competing effects: peripheral chemoreceptor sympathetic activation, vagal effects, lung-stretch interaction, baroreflex interaction, and CNS hypoxic response where the selected domain supports it.
- Keep the acute response time scale separate from longer disease progression.

Important clinical implication:
Acute hypoxia does not produce one universal monotonic HR/MAP response. The published model produces a biphasic response and identifies interaction among reflex mechanisms. Human experimental data also show hypoxia can increase HR, MAP, and sympathetic activity. fileciteturn1file0 fileciteturn1file1

### Replacement C — hypercapnia/acidemia
Current v1.0 has a Stengl experimental anchor. Keep that as a validation datum.

Do not use the Stengl porcine challenge as a universal human equation. Instead:
- use a published chemoreflex model for CO2;
- retain a separate, explicitly bounded acidemia vascular effect;
- validate the combined response against the available experimental domain.

The existing v1.0 distinction between autonomic activation and direct hypercapnic-acidosis vasodilation is conceptually useful and should remain, but its engineering gains need provenance.

### Replacement D — stroke volume / HR interaction
Do not impose an independent HR-to-CO multiplier.

The circulation already contains ventricular pump mechanics. The published baroreflex model specifically shows that cardiac output does not increase indefinitely with pacing because stroke volume can fall at higher rates. This is exactly the failure mode needed to prevent tachycardia from becoming an unlimited source of preserved MAP/CO. fileciteturn1file12

Design:
- allow HR to rise through autonomic control;
- let ventricular filling and pump mechanics determine the resulting stroke volume;
- permit high HR to reduce effective filling and therefore CO when appropriate.

### Replacement E — systemic vascular response
Replace the local conductance formula with a reduced published effector relationship.

The model should permit:
- baroreflex-mediated vasoconstriction during falling pressure;
- vasodilation from relevant local/inflammatory mechanisms;
- progressive failure of compensation when the underlying disease overwhelms the available reserve.

This is central to the current MAP problem. A fixed target-MAP controller can preserve pressure mathematically even while the simulated patient should be entering circulatory failure.

### What Chunk 2 does NOT justify
- No arbitrary MAP ceiling.
- No arbitrary MAP floor used to trigger death.
- No forced HR target such as "make severe ARDS HR 130+" independent of physiology.
- No copied HumMod endocrine/autonomic subsystem.
- No claim that one published model predicts an individual patient's exact HR or MAP.

### Chunk 2 replacement specification
The minimum cardiovascular layer should therefore contain:
1. Baroreceptor sensing.
2. Central sympathetic/vagal integration.
3. Chemoreceptor input from hypoxia and CO2.
4. Four effectors: HR/heart period, contractility, systemic vascular resistance, venous unstressed volume.
5. Existing ventricular pump mechanics.
6. Existing circulation volume conservation.
7. Pulmonary vascular load coupled to the respiratory state.
8. A mechanism for loss of compensation under severe disease.

The first five are directly supported by the Ursino model family; item 8 requires the separate disease/failure layers in later chunks.

### Chunk 2 conclusion
The cardiovascular gap is not "we need more cardiovascular equations." It is "the existing equations need to be replaced with a traceable reduced control model and connected to a failure pathway." This is substantially smaller than the v1.8 approach.


## v2.0 implementation status — 2026-10-22

Branch: `v2.0`

Implemented from the v1.0 clinical-twin chassis:
- retained the v1.0 bedside UI and reduced circulation
- added published Ursino 1998 baroreceptor equations
- added Ursino & Magosso 2000 hypoxia/pulmonary-stretch pathways
- added Magosso & Ursino 2001 O2-CO2 chemoreflex interaction
- added source-family channelized effectors for heart period, contractility, systemic resistance, and venous unstressed volume
- projected source effectors into the v1.0 lumped circulation by dimensionless change from the source operating point; no fitted physiologic gain added
- retained the existing evidence-anchored oxygen-delivery cliff and oxygen-debt/decompensation layer
- retained bounded respiratory-acidosis myocardial depression
- removed the unsourced v1.0 pulmonary-vascular gain from the new autonomic adapter; PVR-specific replacement remains a separate task
- added v2.0 focused regression tests and deployment workflow

Deployment target:
- isolated physician preview at `https://hummod.defying-logic.com/v2.0-preview/`
- never overwrite the v1.6 preview during validation

Remaining physiology work:
1. source-qualified PVR/RV/PEEP coupling
2. sepsis/distributive module
3. metabolic/oxygen-debt consequences beyond the current reduced controller
4. broader clinical scenario validation before any claim of clinical validity

No claim of clinical validation is made.


## v2.x scope decision — physician-approved
Date: 2026-10-22

In scope for the next development sequence:
1. Pulmonary vascular / RV / PEEP coupling.
2. Sepsis / distributive physiology.
3. Oxygen-debt / metabolic-failure refinement.
4. Terminal-state refinement.

Out of scope:
5. Renal / endocrine expansion.

### Sequence
- v2.1: pulmonary vascular / RV / PEEP coupling only.
- v2.2: sepsis / distributive physiology.
- v2.3: oxygen-debt / metabolic-failure refinement.
- v2.4: terminal-state refinement and integrated extremis validation.

### Guardrails
- Keep the v2.0/v1.0 bedside UI and interaction model unchanged unless a physiology requirement forces a minimal display change.
- Do not import later-version architecture wholesale.
- Each stage must use published/source-traceable mechanisms or explicitly bounded surrogates.
- No arbitrary MAP caps, HR targets, death timers, or unsourced gains.
- Each stage must pass regression against all previously accepted scenarios before proceeding.
- Renal/endocrine physiology is explicitly excluded from this project scope unless this decision is later reversed by the physician owner.


## v2.1 implementation status — pulmonary vascular / RV / PEEP coupling
Status: IN PROGRESS

Implemented:
- branch v2.1 from the accepted v2.0 baseline
- source Karamolegkos 2021 pulmonary arteriolar resistance relation
- source Albanese/Karamolegkos pulmonary pressure-volume coordinate translator
- Marshall 1994 HPV response retained with explicit canine-species limitation
- bounded Stengl hypercapnic-acidosis PVR anchor
- reduced-order composition converts each mechanism to a dimensionless resistance ratio and projects total load into the existing v1.0 pulmonary conductance
- v1.0 circulation therefore exposes the load to the existing right-ventricular pump; no separate forced RV output or MAP correction is added
- focused v2.1 tests and CI added

Explicit model assumption:
The mechanical, HPV, and hypercapnic-acidosis resistance ratios are multiplied. This composition is a transparent reduced-order assumption, not a published combined equation. It must remain documented and bounded.

Not added:
- no arbitrary PVR gain
- no forced RV failure threshold
- no MAP cap
- no change to bedside UI
- no renal/endocrine physiology

Current validation gate:
1. pulmonary controller finite at baseline
2. increased airway pressure increases the Karamolegkos mechanical pulmonary load
3. hypoxia increases HPV load
4. hypercapnic acidemia increases the bounded PVR load
5. full live-patient PEEP challenge remains finite and produces dynamic RV/PVR/CO effects
6. all v2.0 accepted regressions remain passing


## v2.1 gate result
Status: PASSED

Focused CI at commit 740c31832d8cca56a23f280f10ff2ca0ab870ddd:
- build: pass
- v2.0 source autonomic regression: pass
- v2.1 pulmonary vascular regression: pass
- live patient regression: pass
- deployable web verification: pass

v2.1 is therefore accepted as the pulmonary vascular / RV / PEEP layer for continued development. This does not imply clinical validation.


## v2.2 interim gate — source sepsis layer
Status: PARTIAL PASS / LIVE BRIDGES INCOMPLETE

Focused CI at commit 751ff281ccbd6fa916023742aa62e7928408e30f:
- build: pass
- v2.0 source autonomic regression: pass
- v2.1 pulmonary vascular regression: pass
- v2.2 Yamanaka source-layer tests: pass
- live patient regression: pass
- deployable web verification: pass

Source-backed mechanisms now available:
- Yamanaka Eq.29 inflammation -> capillary permeability
- Yamanaka Eq.30 inflammation -> vasodilation signal
- Yamanaka Eq.31 inflammation -> reduced left-heart performance
- standard-patient parameters transcribed from Yamanaka Tables 6 and 7

Live authority remains deliberately limited:
- Eq.31 fractional myocardial effect can be projected as a dimensionless LV performance modifier.
- Eq.30 is NOT yet allowed to alter systemic conductance because the exact source radius/resistance bridge must be preserved.
- Eq.29 is NOT yet allowed to remove intravascular volume because the compact v2 chassis lacks the required interstitial/oncotic state.

Do not call v2.2 complete until the two unresolved bridges above are solved or explicitly accepted as deferred.


## v2.2 final gate
Status: PASSED

Focused CI at commit 2c07a0bbabf6c661ae5ff37754f3958a1991a2d6:
- build: pass
- v2.0 systemic/autonomic regression: pass
- v2.1 pulmonary vascular regression: pass
- v2.2 Yamanaka source equations: pass
- live patient regression, including explicit myocardial depression, vasodilation, and capillary-volume exchange: pass
- deployable web verification: pass

v2.2 is accepted for continued development. This does not imply clinical validation.


## v2.3 final gate
Status: PASSED

Focused CI at commit e34005539bff9ab8e03e60926b35b80ff420b4c3:
- build: pass
- v2.0 autonomic regression: pass
- v2.1 pulmonary vascular regression: pass
- v2.2 sepsis regression: pass
- v2.3 oxygen-deficit bookkeeping: pass
- live patient regression: pass
- deployable web verification: pass

v2.3 separates source-grounded oxygen-deficit bookkeeping from failure authority. Accumulated unmet aerobic demand is tracked, but no fixed oxygen-debt amount is promoted as a universal death, arrest, lactate, or contractility threshold.

Next: v2.4 terminal-state refinement. The legacy 35-minute debt normalization and asphyxial elapsed-time arrest bridge are explicit replacement targets.


## v2.4 final gate
Status: PASSED

Focused CI at commit 8e762a0edd33db8dbdeb155c076aaefafcd9ae8a:
- build: pass
- v2.0 autonomic regression: pass
- v2.1 pulmonary vascular regression: pass
- v2.2 sepsis regression: pass
- v2.3 oxygen-deficit regression: pass
- v2.4 terminal-state regression: pass
- live patient/extremis regression: pass
- deployable web verification: pass

Terminal-state changes:
- removed elapsed-asphyxia time as direct arrest authority
- removed fixed oxygen-debt amount as direct arrest authority
- retained mechanical pump failure -> PEA
- retained sustained profound hypotension collapse criteria
- added a source-anchored asphyxial hemodynamic-collapse envelope that requires simultaneous oxygen-supply failure, severe acid-base/gas abnormality, and deterioration of HR and MAP relative to the modeled patient baseline
- terminal physiology is therefore state-dependent rather than a timer

Additional v2.4 corrections:
- severe hypercapnic myocardial depression is bounded by published experimental anchors and is not extrapolated beyond the source range
- hypercapnic systemic vasodilation is bounded by the published swine challenge
- the reduced LungCO2 solver no longer uses an arbitrary 0.5 gas-fraction search ceiling; extreme hypoventilation is bounded at the physically admissible alveolar gas-fraction limit instead of crashing

Scope items 1-4 are now implemented:
1. pulmonary vascular / RV / PEEP coupling — v2.1
2. sepsis / distributive physiology — v2.2
3. oxygen-deficit / metabolic-failure bookkeeping — v2.3
4. terminal-state refinement — v2.4

Renal/endocrine remains out of scope.

Next gate:
Integrated physician scenario validation of v2.4 before promotion to the HumMod preview.


## v2.4 HR/MAP physician finding — 2026-10-25
Status: CORRECTED / CI PASS

Physician observation:
- severe hypoxemia/hypercapnia produced elevated MAP with inappropriately low HR.

Autonomic diagnostic:
- baseline: HR 73.3/min, fAb 16.1, fAc 4.0, fSh 7.0, fV 5.1 spikes/s.
- severe challenge (MAP 104, PaO2 35, PaCO2 110, pH 6.90): source-model HR 48.9/min, fAb 35.8, fAc 21.2, fSh 60 (saturated), fV 13.1 spikes/s.
- same gas state at MAP 70: source-model HR 73.9/min.
- high MAP therefore drove strong baroreceptor/vagal braking despite maximal cardiac sympathetic firing. The defect was not absent sympathetic drive.

Interpretation:
- Ursino/Magosso can produce bradycardia during CO2 rise under artificial ventilation when the lung-stretch chronotropic mechanism is absent/weak; this is source-consistent within that model domain.
- Extrapolation of that response into severe mechanically ventilated ARDS conflicted with clinical ARDS hypercapnia observations, where HR generally rises modestly with PaCO2 around 70-80 mmHg.
- The correction therefore preserves the source neural calculation for diagnostics but adds a bounded representative chronotropic envelope anchored to published ARDS/hypercapnia data rather than an arbitrary target HR.

Applied chronotropic anchors:
- PaCO2 40: ratio 1.0.
- PaCO2 80: HR ratio 95/89 from Weber et al. ARDS permissive-hypercapnia cohort.
- PaCO2 110: HR ratio 154/117 from severe acute hypercapnic-acidosis swine data; explicitly species-limited.
- no extrapolation beyond the severe anchor.
- applied HR = max(source-model HR, baseline HR x bounded evidence ratio).

At a baseline HR of 75/min and PaCO2 110, the applied representative floor is about 98.7/min; the underlying source-model HR remains visible (~48.9/min in the fixed high-MAP diagnostic). No "HR must be 130" rule was added.

Terminal-state interaction:
- forcing the HR floor exposed an old terminal assumption that required bradycardia for the asphyxial collapse envelope.
- this was replaced with falling forward cardiac output plus falling MAP relative to the patient's own modeled baseline, combined with oxygen-supply failure and the source severe asphyxial gas/acid-base envelope.
- this uses forward-flow deterioration as the reduced-circulation surrogate for the published loss of aortic fluctuations and does not use a fixed oxygen-debt or elapsed-time death threshold.

Final focused CI at commit f6fa88141ac869b59b532977fa9c1562d7c3cc75:
- v2.0 autonomic regression: pass
- v2.1 pulmonary vascular regression: pass
- v2.2 sepsis regression: pass
- v2.3 oxygen-deficit regression: pass
- v2.4 terminal-state regression: pass
- autonomic extremis diagnostic: pass
- live patient/extremis regression: pass
- deployable web verification: pass


## v2.4 HR replacement - Lin 2012 steady-state source-model result
Date: 2026-10-25
Status: PROMISING SOURCE MODEL / NOT YET LIVE

The empirical PaCO2->minimum-HR interpolation is rejected as final physiology.

A primary-source steady-state implementation of Lin, Ngwompo & Tilley 2012 Eqs. 12-31 was added:
- src/lin_2012_steady_state_hr_candidate.js
- test/v24_lin_2012_steady_state_hr_candidate.test.js

No HR target, fitted gain, or PaCO2->HR interpolation is present.

At steady state the dynamic filters/delays have unit DC gain, allowing the published static relationship to be tested without inventing the unlisted central-compartment tau_c.

Key source mechanisms:
- Eq. 30: hypoxia/hypercapnia reset the baroreflex operating pressure.
- Eq. 31: hypercapnia increases sympathetic gain.
- Eqs. 14-17: published SNA/PNA sigmoids.
- Eqs. 18-28: published nonlinear sympathetic/vagal heart-rate effector.
- Figure 3 supplies the inhibitory sign of the vagal branch.

Fixed result:
- normal gas, MAP 104: HR 106.3/min
- severe gas (PaO2 35, PaCO2 110), MAP 104: HR 112.9/min
- severe gas, MAP 70: HR 116.9/min

MAP sweep (normal vs severe gas) produced:
- MAP 60: 109.8 vs 118.0
- MAP 70: 109.0 vs 116.9
- MAP 80: 108.2 vs 115.8
- MAP 90: 107.4 vs 114.6
- MAP 100: 106.6 vs 113.4
- MAP 104: 106.3 vs 112.9
- MAP 110: 105.8 vs 112.2

Thus the published Lin baro-chemoreflex interaction does NOT reproduce the inappropriate high-MAP bradycardia seen in the current Ursino/Magosso path.

Mechanism at MAP 104:
- normal demand pressure: 92.68 mmHg
- severe-gas demand pressure: 119.88 mmHg
- normal SNA: 2.93 Hz
- severe-gas SNA: 5.33 Hz
- normal PNA: 3.53 Hz
- severe-gas PNA: 2.98 Hz

Interpretation:
Severe gas stress resets the operating point above the observed MAP and increases central sympathetic gain, so a MAP of 104 mmHg no longer falsely behaves as dominant hypertension requiring marked vagal braking.

Gate:
CI at commit 5814e83ce5611eac90d44d1b6d4cf98f69a83084 passed:
- Lin Eq30/31 tests
- Lin steady-state HR candidate tests
- all prior v2.0-v2.4 regressions
- live patient regression
- deployable-web verification

Remaining blocker before live cutover:
The full dynamic Lin controller must be ported without inventing tau_c or ambiguous source notation. Until then the Lin implementation remains diagnostic/shadow-only and the empirical HR floor must not be considered accepted physiology.


## v2.4 Albanese lung-stretch source audit — 2026-10-25
Status: SOURCE CORRECTION / NO PHYSIOLOGY CHANGE

Primary-source verification:
- Albanese et al. 2016 cardiovascular control explicitly uses tidal volume (V_T) as the input to the lung-stretch receptor pathway in Fig. 10.
- The published modified lung-stretch gain is G_asr = 11.76 spikes/s/L.
- The cardiovascular-control equations remain based on the Ursino/Magosso family; Albanese does not replace the autonomic lung-stretch stimulus with PEEP, mean airway pressure, end-expiratory lung volume, or absolute alveolar volume.
- Therefore, replacing V_T with an FRC/PEEP/absolute-volume term and labeling it “Albanese” would be an unsupported model modification.

Existing diagnostic:
- the source-faithful Albanese Table-7 candidate has already been run with the existing heart-period effector.
- baseline HR: ~62.8/min.
- severe gas + MAP 104: ~48.5/min.
- severe gas + MAP 70: ~73.0/min.
- Albanese Table-7 calibration alone therefore does not remove the high-MAP severe-gas bradycardia.

Mechanical-ventilation distinction:
- Karamolegkos et al. 2021 adds PEEP/PPV heart-lung mechanics using alveolar volume, pleural pressure, pericardium, septal interaction, and pulmonary-vessel compression.
- Those mechanical pathways are separate from the Albanese autonomic V_T -> lung-stretch afferent.
- v2.1 already contains a source-coordinate pulmonary mechanics/vascular path for this role.

Decision:
- do NOT add an empirical PaCO2 -> HR floor as accepted physiology.
- do NOT invent an alveolar-volume/PEEP -> autonomic stretch mapping and attribute it to Albanese.
- retain the Albanese candidate as a source-fidelity diagnostic.
- continue the Lin 2012 baro-chemoreflex/heart-rate controller as the current published replacement candidate because its severe-gas high-MAP result is directionally credible without a target-HR floor.


## v2.4 existing-equation HR search — Albanese vs Lin
Date: 2026-10-25

### Albanese 2016 primary-source calibration
Implemented in shadow:
- src/albanese_2016_autonomic_candidate.js
- test/v24_albanese_hr_shadow_diagnostic.js

Primary-source Table-7 calibration was transcribed without fitting:
- lung-stretch gain 11.76 spikes/L/s
- W_b,sp -1.1375
- W_pc,sp 1.716
- W_sr,sp -0.3997
- W_b,sv -1.0806
- W_pc,sv 1.716
- W_sr,sv -0.2907
- W_b,sh -1.75

Result:
- baseline HR 62.8/min
- MAP 104, PaO2 35, PaCO2 110, low VT 0.10 L: HR 48.5/min
- same gas at MAP 70: HR 73.0/min
- MAP 104, same gas, VT 0.50 L: HR 50.2/min

Conclusion:
The Albanese calibration does not solve the mechanically-ventilated high-MAP bradycardia. This is consistent with the model family's dependence on lung-stretch input and should not be promoted as the HR fix.

### Lin 2012 source equation remains the strongest candidate
Lin, Ngwompo & Tilley 2012 explicitly couples chemoreflex to baroreflex:
- Eq.30 resets the baroreflex operating pressure as O2/CO2 change.
- Eq.31 increases central sympathetic gain with hypercapnia.
- Eqs.12-28 provide the baroreflex/efferent/HR algebra.

The published steady-state implementation already demonstrates:
- MAP 104 normal gas: HR 106.3/min
- MAP 104, PaO2 35, PaCO2 110: HR 112.9/min
with no fitted HR target or PaCO2-to-HR interpolation.

Dynamic cutover remains blocked:
- Eq.13 contains a central-compartment time constant tau_c.
- The primary 2012 paper's Table A2 does not provide a numerical tau_c.
- The paper states first-order-filter timing was sourced from an earlier reference, but no verified numerical tau_c has yet been recovered.
- No value will be invented or borrowed from an unrelated baroreflex model.

Decision:
- empirical PaCO2->HR floor is rejected as accepted physiology.
- Albanese 2016 remains a negative/validation shadow result.
- Lin 2012 steady-state equation is accepted as the leading existing-equation explanation but remains shadow-only until the complete dynamic parameter provenance is found.


## v2.4 existing-equation HR source hunt — 2026-10-25 update
Status: DYNAMIC LIN CUTOVER STILL BLOCKED / EMPIRICAL FLOOR REJECTED

Additional source search:
- Lin, Ngwompo & Tilley 2012 Eq.13 explicitly defines a central-compartment first-order filter with time constant tau_c.
- The 2012 parameter table reports tau_aff=0.001 s, G_aff=1, and P_demand=90 mmHg, but no numerical tau_c.
- Jinhuai Lin's 2007 University of Bath thesis likewise lists the afferent and central-compartment parameters without a numerical tau_c.
- The 2006 precursor paper, "Development of a Cardiovascular Model with Baroreceptor Reflex" (ESM 2006, p.229), is indexed and confirms the same three-compartment baroreflex architecture, but no publicly accessible full text/source code with tau_c was found.
- Searches using the distinctive published constants and notation did not recover an independent executable/source implementation containing tau_c.

Scientific consequence:
- The Lin steady-state equations remain usable exactly because all first-order filters/delays have unit DC gain.
- A fully dynamic Lin implementation cannot be claimed source-faithful until tau_c is recovered.
- Do NOT choose tau_c by fitting, borrow it from Ursino, set it to zero, or infer it from the desired HR response.
- Do NOT promote the empirical PaCO2-to-HR floor as accepted physiology.

Current best source-backed result:
- Lin 2012 steady-state baro-chemoreflex equations remove the high-MAP bradycardic behavior without a target HR:
  MAP 104 / normal gas -> HR 106.3/min
  MAP 104 / PaO2 35 / PaCO2 110 -> HR 112.9/min.
- This remains a shadow/diagnostic result pending a dynamic-authority decision.

Next permissible options:
A. recover the original Lin/Ngwompo/Tilley Simulink/source implementation or a source-authored tau_c;
B. explicitly approve a quasi-steady Lin controller as a reduced-model approximation, with dynamicAuthority=false;
C. retain the known-bad Ursino/Magosso live HR while Lin remains shadow-only.

Option B must not be activated without physician-owner approval because applying the steady-state algebra at every simulation step is an explicit reduction, not the published complete dynamic model.


## v2.4 Lin-existing-equation HR experiment — 2026-10-25

Goal:
Replace the ad hoc PaCO2->minimum-HR interpolation with an existing published
baro-chemoreflex/HR equation set.

Candidate:
Lin J, Ngwompo RF, Tilley DG. Proc Inst Mech Eng H. 2012;226:787-803.
doi:10.1177/0954411912451823.

Why this candidate:
- human cardiopulmonary model
- explicit baroreflex + chemoreflex interaction
- published sympathetic/parasympathetic HR effector equations
- validated under hypoxia and hypercapnia
- reported predicted-vs-measured HR and MAP changes within 3%

Current exact steady-state source transcription:
- Eqs. 12-17: afferent/central/efferent baroreflex
- Eqs. 18-28: nonlinear sympathetic/parasympathetic HR effector
- Eqs. 30-31: peripheral chemoreflex baroreflex reset and central CO2
  sympathetic-gain modulation
- Tables A2/A3 parameters already transcribed where source-readable

Result:
At MAP 104 mmHg / PaO2 35 / PaCO2 110, the Lin steady-state model predicts
HR 112.91/min versus 106.26/min at the same MAP with normal gases. Thus the
published Lin model does NOT reproduce the inappropriate high-MAP
bradycardia seen in the Ursino/Magosso branch.

Patient operating-point shadow:
HR_projected =
  HR_patient_reference +
  (HR_Lin_current - HR_Lin_reference)

This is not a new dose-response equation or fitted gain. It is an explicit
operating-point translation that preserves the source model's predicted
delta-HR while retaining the authored patient's resting HR.

For patient reference HR 75/min:
- severe MAP 104 / PaO2 35 / PaCO2 110 -> projected HR 79.83/min
- source Lin absolute HR at the same state -> 112.91/min
- source delta from the declared reference state -> +4.83/min

Interpretation:
- Lin supplies the missing baro-chemoreflex reset mechanism and correctly
  changes HR in the tachycardic direction at high MAP.
- The small translated delta means source-delta projection alone is not yet
  sufficient to justify the bedside magnitude expected in severe ARDS.
- Do NOT activate either absolute Lin HR or the translated HR yet.
- The current empirical hypercapnic HR floor remains untouched on accepted
  v2.4 while this experimental branch is evaluated.

Dynamic blocker:
The complete source transient central-compartment parameterization is not yet
fully verified. No missing tau_c or other dynamic term will be invented.
Until that is resolved, Lin HR remains shadow-only.

Branch:
v2.4-lin-hr

Promotion rule:
No live cutover until exact source dynamics are recovered/verified and the
published hypercapnia/hypoxia validation scenarios are reproduced sufficiently
to establish that the implementation, not merely the response direction, is
source-faithful.
