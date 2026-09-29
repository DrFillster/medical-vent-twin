# Provenance Refactor and Scientific Upgrade Plan

## Goal

Make every physiologically meaningful variable and condition auditable, then replace the most consequential engineering assumptions with source-preserved HumMod behavior or stronger published models.

## Phase 1 - provenance infrastructure
- Add a central provenance schema, validator, and registry.
- Register every constant, equation, condition, boundary, topology rule, and scenario value in the live clinical path.
- Export provenance IDs in clinical snapshots/session records.
- Add tests that fail when UNKNOWN provenance is active.
- Add a literal/condition audit script to identify unregistered physiology-affecting code.

## Phase 2 - live-path full coverage
Priority order:
1. `clinical_twin_live_hummod_session.js`
2. `hummod_ards_cardiopulmonary_runtime.js`
3. gas/chemistry/breathing/pulmonary membrane
4. circulation/hemodynamics
5. thorax bridge
6. autonomic controller
7. oxygen-supply cliff
8. decompensation/arrest
9. Vent mechanics/recruitment/presets
10. Berlin case catalog and scenario defaults

Completion criterion: every live output has a dependency trail with no UNKNOWN element.

## Phase 3 - replace high-impact assumptions

### A. Autonomics
Trace and port the smallest validated HumMod autonomic/baroreflex/catecholamine dependency set that can run over the acute time horizon. Compare against the current custom controller and retire project transfer functions where source-preserved behavior is feasible.

### B. Distributed circulation
Replace effective lumped systemic conductances progressively with HumMod source-aligned systemic/organ pathways required for acute ventilator-hemodynamic interaction.

### C. Thorax/PEEP coupling
Build a better pleural/pericardial pressure model with explicit chest-wall phenotype and validate pressure transmission against published passive-ventilation data. Keep PEEP mechanics in Vent because pinned native HumMod lacks PEEP.

### D. ARDS phenotype generation
Replace hand-authored compartment percentages/AOP/resistance/perfusion/dead-space parameters with a calibrated latent-parameter model constrained by published ARDS mechanics, recruitability, CT, and airway-closure distributions. Preserve Berlin severity and recruitability as independent axes.

### E. Shock/decompensation
Keep a clear educational mode until validated. Separate reversible physiologic deterioration from terminal-event logic. Do not label modeled arrest time as survival prediction.

## Phase 4 - native HumMod calibration loop
- Run matched native HumMod perturbation sweeps.
- Store raw native outputs, source revision, scenario assignments, and parser version.
- Calibrate only parameters that can be matched across model boundaries.
- Report native-vs-reduced discrepancies rather than declaring equivalence.
- Never auto-promote reduced code to "full HumMod".

## Phase 5 - publication/UI
Expose a model-provenance panel showing:
- subsystem;
- source class;
- exact HumMod revision/path where applicable;
- literature source;
- engineering assumptions;
- current active values;
- validation status.

Update manuscript language to distinguish native HumMod, HumMod-exact translated equations, HumMod-adapted relations, literature-calibrated relations, and synthetic assumptions.

## Immediate implementation started in this branch
- normative critique added;
- provenance standard added;
- this roadmap added;
- central provenance code/registry introduced;
- initial live-path records and tests added next.

## Additional recommendation

Add a "scientific debt budget" to each release: count active ENGINEERING_ASSUMPTION and UNKNOWN records by subsystem. New releases should not increase either count without an explicit rationale and test.