# Versioning and Native HumMod Coupling Architecture

## Decision

Native deployed HumMod coupling is a **v2.0** architectural milestone, not a v1.x feature.

The v1.x line remains the browser-native simulator:
- Vent owns pulmonary mechanics and ventilator interaction.
- A reduced source-aligned HumMod cardiopulmonary core provides systemic physiology.
- Custom/literature-calibrated control and decompensation layers remain explicitly provenance-tagged until replaced or retired.

The v2.0 line introduces a deployed HumMod runtime as the systemic physiology authority.

## Version roadmap

### v1.0
Current released simulator.

Scope:
- persistent Vent mechanics;
- reduced source-aligned HumMod blood-gas/hemodynamic physiology;
- synthetic ARDS teaching cases;
- reduced autonomic/decompensation behavior;
- explicit non-clinical-validation status.

### v1.1 — provenance release
Goals:
- complete machine-readable provenance coverage;
- every physiology-affecting variable, equation, condition, threshold, transition, and scenario value tagged;
- provenance exported with session records;
- UI provenance disclosure;
- zero active UNKNOWN provenance in the release-gated live path.

### v1.2 — physiology hardening
Goals:
- replace the highest-impact engineering assumptions where source-preserved HumMod behavior is feasible;
- prioritize autonomic, baroreflex, catecholamine, vascular, and cardiac response;
- strengthen PEEP/thorax/hemodynamic coupling;
- establish permanent reference perturbation experiments and validity envelopes.

### v2.0 — deployed native HumMod co-simulation
Goal:
Use a deployed HumMod runtime as the systemic physiology authority while retaining the Vent engine for detailed ventilator/lung mechanics that native HumMod does not expose.

## Authority split

### Vent engine owns
- ventilation mode;
- tidal volume or inspiratory pressure;
- respiratory rate;
- inspiratory flow/time;
- PEEP;
- airway pressure/flow/volume waveforms;
- compartment mechanics;
- airway opening behavior;
- recruitment/derecruitment;
- inspiratory hold;
- expiratory hold;
- plateau pressure;
- total/intrinsic PEEP;
- driving pressure;
- mechanical ARDS phenotype state.

### Native HumMod service owns
- systemic arterial/venous circulation;
- cardiac function;
- autonomic control;
- neurohumoral responses;
- organ perfusion;
- metabolism;
- oxygen consumption/carbon-dioxide production;
- acid-base physiology;
- blood-gas transport;
- systemic compensation/decompensation where represented by HumMod.

## Coupling layer owns

The coupling layer must explicitly translate between the two model domains.

Vent -> HumMod examples:
- mean airway pressure;
- pleural/intrathoracic pressure estimate;
- pericardial pressure boundary;
- pulmonary recruitment/perfusion state;
- inspired O2/CO2;
- minute ventilation/alveolar ventilation;
- gas exchange boundary variables;
- pressure history where required.

HumMod -> Vent/UI examples:
- HR;
- MAP;
- CO;
- SV;
- systemic and pulmonary vascular pressures/resistance;
- mixed venous O2 state;
- arterial gases and pH;
- metabolic demand;
- autonomic/catecholamine state;
- organ-flow outputs when exposed.

Every cross-model variable must itself carry provenance and unit metadata.

## Minimum HumMod service contract before v2.0 coupling

The deployed runtime must reliably support:

1. deterministic patient initialization from a versioned state;
2. deterministic advancement of model time;
3. external boundary/intervention inputs;
4. stable physiologic output schema;
5. save/reload of patient state;
6. source revision/runtime version reporting;
7. explicit unit metadata;
8. reproducible error/status behavior.

## Suggested service API

### Create session
`POST /v2/sessions`

Returns:
- session id;
- HumMod source revision;
- service build/version;
- initialized model time;
- supported input/output capabilities.

### Step session
`POST /v2/sessions/{id}/step`

Inputs:
- dt;
- ventilator/coupling boundaries;
- interventions;
- expected prior model time/state revision.

Returns:
- new model time;
- systemic physiology;
- accepted/applied boundaries;
- warnings;
- provenance/runtime metadata.

### Snapshot
`GET /v2/sessions/{id}`

Returns current state and output contract.

### Restore
`POST /v2/sessions/{id}/restore`

Restores a versioned saved state.

## Synchronization

Do not couple the browser to a free-running server clock.

Use deterministic lock-step co-simulation:
1. Vent advances over an agreed interval.
2. Vent summarizes mechanical boundary conditions.
3. HumMod advances exactly the same model interval.
4. HumMod returns systemic state.
5. Coupling layer commits the joint state.
6. UI renders only committed states.

The coupling interval should be independently validated and versioned.

## Failure behavior

If native HumMod becomes unavailable:
- do not silently switch physiology authorities mid-session;
- mark the native session interrupted;
- preserve the last committed joint state;
- optionally permit an explicitly labeled reduced-core fallback only by starting a new session or explicit migration operation.

## Scientific boundary

v2.0 should be described as a **co-simulation**, not as “Vent running inside HumMod” or “full HumMod ventilation.”

Native HumMod remains authoritative only for the subsystems it actually executes. Vent remains authoritative for PEEP-dependent lung mechanics, recruitment, holds, and detailed ventilator waveforms.

## Development sequencing

Work can proceed in parallel:

### v1.x track
- finish provenance;
- harden autonomics/hemodynamics;
- replace unsupported engineering assumptions;
- build reference experiments.

### v2.0 track
- define service schema;
- verify deployed HumMod session lifecycle;
- validate unit mappings;
- implement lock-step coupling adapter;
- run matched native-vs-reduced experiments;
- migrate UI to selectable native provider only after service reliability is established.

## Release gate for v2.0

Do not call the product v2.0 until:
- deployed HumMod service passes deterministic initialize/step/save/restore testing;
- coupling variables have complete provenance and unit contracts;
- lock-step synchronization passes repeatability tests;
- native-vs-reduced reference experiments are archived;
- authority boundaries are visible in UI and exported session records;
- failure behavior has been tested;
- the system never silently mislabels reduced physiology as native HumMod.
