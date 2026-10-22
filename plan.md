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
