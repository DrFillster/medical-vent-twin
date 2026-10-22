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
