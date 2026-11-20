# Multiple-state capability matrix - research implementation audit

Scope: active clinical_twin_live_hummod_session.js plus development_model_adapter.js,
fit_controlled_mechanics.js and referenced mechanics/thorax modules. Source inspection
only; not newly validated disease models. No new statistical phenotypes.

| Capability | Current implementation | Status / next test | Evidence required for patient selection |
|---|---|---|---|
| Preserved mechanics | Mechanics override exists but scales aspiration compartment template | Not established as a non-ARDS configuration; inspect compartment defaults and coupled gas boundaries | Baseline pressure/volume data and documented ventilation indication |
| Increased resistance | Central resistance scaling in mechanicsParams; dynamic expiratory flow solver exists | Configurable; test expiratory emptying, hold measurements and rate/expiratory-time sensitivity before calling obstructive disease supported | Obstructive clinical evidence and compatible mechanics/flow data |
| Reduced compliance | Current scale increases compartment elasticScale AND reduces capacity | Configurable coupled change; separate stiffness from capacity before interpreting as isolated compliance | Suitable pressure/volume measurements and effort context |
| Recruitment heterogeneity | Three compartment types; initializer normal=1, consolidated=0 enforced; recruitable adjustable | Template-dependent; inspect compartment definitions and test PEEP/recruitment behavior | Imaging/context and repeated ventilator/mechanics observations |
| Chest-wall loading | Thorax bridge uses common elastance fraction 0.25 in live path | No patient-specific chest-wall fitting exposed here; reduced quasi-static bridge only | Specific pressure evidence where available; body size alone insufficient for unique assignment |
| Drive and muscle transmission | Separate patientDriveRelativeOverride and patientMuscleTransmissionOverride | Configurable; nominal awake profile not observed alertness; independent control tests pending | Sedation/paralysis and spontaneous-breath evidence; measured effort/strength if available |
| Gas-exchange inefficiency | Dead-space and ventilated-perfusion overrides plus SID input | Used in prior fitting; not diagnosis-specific; stable fit does not identify underlying cause | Time-matched blood gas, ventilation and relevant supporting evidence |
| Cardiovascular disease | Multiple candidate/shadow/runtime components in source tree | Do not infer active capability from filenames; audit selected provider path before fitting cardiac disease | Timestamped hemodynamics and documented cardiac/shock context |
| Mixed configuration | Several physiological overrides can coexist | Test interactions and parameter ambiguity; no exclusive one-disease rule | Combined source-supported findings |

## Engineering decisions

Do not remove case-ID guard and declare multiple diseases supported. Replace
implicit template assumptions with an explicit, source-traceable patient
configuration in research only. Preserve engine version, old adapter and saved
19-case results unchanged for regression comparison.

First tests: (1) isolate resistance, stiffness and capacity effects; (2) expose
and log recruitment assumptions; (3) independent drive/transmission changes;
(4) identify fixed chest-wall/cardiovascular boundaries. These are numerical
mechanism tests, not clinical validation. No patient-specific clinical score or
new derived medical quantity is computed in this document.

## MIMIC example selection contract

Select examples only after source-module and timestamp inventory. Document
pre-transition clinical evidence, raw measurements, missingness, fit ambiguity
and concurrent interventions. Clinical diagnosis is not inferred from a fitted
control or default scenario. No examples selected by post-change success.
Current 19 remain development; include failures and cases without assignable
clinical disease. Do not force all states to be represented within 19 cases.

Next deliverable: executable one-control-at-a-time research tests and a source
availability report; then choose evidence-supported example configurations.
No new patient diagnoses, labels, outcome reads or production edits in this pass.
