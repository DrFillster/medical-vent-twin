# v2.0 HumMod Co-Simulation Architecture

## Definition

v2.0 is defined by **full-semantics HumMod physiology behind a modern headless interface**, coupled to the Vent mechanical lung/ventilator engine.

Production v2.0 is **not required to use HumMod.exe**.

Preferred implementation order:
1. headless runtime executing the official pinned HumMod DES source;
2. generated JS/TS from the same verified intermediate representation;
3. FMI/Modelica only if equivalence to the pinned source is demonstrated;
4. HumMod.exe retained as a reference oracle, not the production interface.

## Version roadmap

### v1.0
Current browser simulator:
- Vent mechanics;
- reduced source-aligned HumMod core;
- synthetic ARDS cases;
- custom/literature-calibrated autonomic and decompensation logic.

### v1.1
Provenance completion:
- every physiologic variable, equation, threshold, condition, transition, and scenario value tagged;
- provenance exported with session state;
- zero active UNKNOWN provenance in release-gated live physiology.

### v1.2
Physiology hardening:
- replace highest-impact custom autonomic/hemodynamic assumptions;
- strengthen PEEP/thorax/systemic coupling;
- establish permanent reference experiments and validity envelopes.

### v2.0
Vent + full-semantics headless HumMod co-simulation.

## Authority split

### Vent owns
- ventilation mode;
- VT / inspiratory pressure;
- RR;
- inspiratory flow/time;
- PEEP;
- pressure/flow/volume waveforms;
- compartment mechanics;
- recruitment/derecruitment;
- airway opening;
- inspiratory and expiratory holds;
- plateau pressure;
- intrinsic PEEP;
- driving pressure.

### HumMod runtime owns
- systemic circulation;
- cardiac physiology;
- autonomics;
- neurohumoral responses;
- organ perfusion;
- metabolism;
- blood-gas transport;
- acid-base physiology;
- systemic compensation/decompensation represented in the source model.

## Coupling

Vent -> HumMod:
- mean airway pressure;
- pleural/intrathoracic pressure;
- pericardial pressure boundary;
- inspired gases;
- minute/alveolar ventilation;
- recruitment/perfusion descriptors;
- shunt/dead-space descriptors where needed.

HumMod -> Vent/UI:
- HR;
- MAP;
- CO;
- SV;
- systemic/pulmonary vascular pressures;
- mixed venous state;
- arterial gases/pH;
- metabolism;
- autonomic state;
- organ flow.

Every cross-model field must carry:
- units;
- source;
- provenance ID;
- authority;
- model time.

## Runtime interface requirements

The headless HumMod runtime must support:
1. deterministic initialization;
2. deterministic model-time stepping;
3. external boundary application;
4. stable output schema;
5. save/restore;
6. exact source revision reporting;
7. runtime build/version reporting;
8. unit metadata;
9. provenance metadata;
10. explicit unsupported-feature errors.

## Synchronization

Use lock-step co-simulation:

1. Vent advances a defined coupling interval.
2. Vent computes the coupling boundary summary.
3. HumMod advances exactly the same interval.
4. HumMod returns systemic state.
5. The coupling layer commits the joint state.
6. The UI renders only committed states.

No free-running remote physiology clock.

## HumMod.exe

Use HumMod.exe for:
- reference trajectories;
- .SOLN generation;
- initialization comparison;
- intervention comparison;
- save/reload comparison;
- regression adjudication.

Do not depend on GUI automation for production.

## Release gate

Do not label a release v2.0 until:
- the headless runtime passes deterministic initialize/step/save/restore tests;
- a representative DES slice is numerically matched to native HumMod;
- coupling variables have complete units/provenance;
- synchronization is repeatable;
- authority boundaries are visible in the UI;
- fallback behavior never silently changes physiology authority;
- native/reference discrepancies are archived and reviewable.
