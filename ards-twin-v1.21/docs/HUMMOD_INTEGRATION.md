# HumMod Integration

Status: design + implementation contract for v0.5

## Purpose

HumMod will provide the systemic whole-body physiology side of the ARDS digital twin. The Vent engine will continue to provide the higher-resolution ventilator/lung mechanics that are central to this application.

This document deliberately avoids guessed HumMod variable names. A mapping is not considered valid until the exact source path is verified against the HumMod revision/export used.

## Current upstream packaging reviewed

The public `riliescu/hummod-standalone` repository currently contains:

- root model description files including `HumMod.DES` and `Model.DES`
- model hierarchy directories including `Context`, `Control`, `Display`, `Docs`, and `Structure`
- a Windows executable (`HumMod.EXE`)
- documentation organized by physiologic domain, including acid-base and respiratory/air-supply material

No HumMod executable or model files are vendored into this repository.

## Architecture decision

### Vent owns

- ventilator mode and settings
- delivered pressure/flow/volume waveforms
- compartmental lung mechanics
- recruitment/derecruitment state
- airway resistance and lung mechanical heterogeneity
- inspiratory/expiratory hold maneuvers
- measured plateau pressure and total/intrinsic PEEP
- driving-pressure measurement derived from valid maneuver data

### HumMod owns, when mapped and available

- systemic hemodynamic state
- systemic acid-base state
- systemic oxygen/CO2 transport variables
- metabolic state
- fluid/renal state
- neurohumoral state
- other whole-body variables explicitly mapped for a scenario

### Ownership requiring an explicit coupling decision

These domains can create circular authority if both engines independently solve them:

- arterial oxygen and carbon dioxide
- pulmonary shunt/dead-space representation
- cardiac-output effects on pulmonary gas exchange
- respiratory drive/spontaneous effort
- intrathoracic-pressure effects on venous return

Before closed-loop coupling is enabled, each shared variable must have one authoritative solver for a given time step.

## Normalized interchange schema

`src/digital_twin_contract.js` is the stable boundary between the application and a physiology provider. It currently normalizes:

- respiratory: compliance, resistance, shunt fraction, dead-space fraction, recruitability index
- gas exchange: PaO2, PaCO2, pH, SpO2
- hemodynamics: heart rate, mean arterial pressure, cardiac output, central venous pressure
- metabolism: oxygen consumption and CO2 production

Missing optional values remain `null`. They are not inferred.

The provider metadata should identify at minimum:

- provider name
- model/export version or source revision when known
- subject/case identifier when applicable
- run identifier when applicable

## Phase 1 — explicit mapping

The first adapter accepts:

1. a HumMod export/source object
2. a caller-supplied mapping specification containing verified source paths
3. provider/version/run metadata

Example concept only:

```js
const mapper = createHumModSnapshotMapper({
  modelVersion: 'verified-upstream-version',
  fields: {
    timestampSec: 'VERIFIED.HUMMOD.PATH',
    'gasExchange.pao2MmHg': 'VERIFIED.HUMMOD.PATH',
    'hemodynamics.cardiacOutputLPerMin': 'VERIFIED.HUMMOD.PATH',
  },
});
```

The placeholder path text above is intentionally not executable. Production mappings must use verified upstream names.

Mapping rules:

- no fuzzy matching
- no nearest-name matching
- no implicit unit conversion
- source units must be documented
- unsupported/missing optional fields map to `null`
- missing required fields fail loudly
- source revision/version is stored with the normalized snapshot/provider

## Phase 2 — deterministic replay provider

A replay provider consumes a versioned sequence of normalized HumMod snapshots. This is the first practical browser-compatible integration path.

Use cases:

- reproducible ARDS teaching cases
- regression tests
- validating UI/systemic-state visualization
- testing time synchronization before live coupling

A replay trajectory must not pretend to dynamically respond to an intervention that was not represented in the source trajectory. Unsupported interventions should fail explicitly rather than synthesize an unvalidated physiologic response.

## Phase 3 — live provider

A live provider can host the supported HumMod runtime outside the static browser application and implement the same provider interface:

```text
initialize(case/config)
sample(time)
applyIntervention(event)
```

The browser should not depend on HumMod's executable format, directory layout, or raw variable names. Only the adapter/provider layer should know those details.

## Proposed coupling cadence

Two time scales are expected:

- fast lung mechanics / ventilator waveform stepping inside the Vent engine
- slower systemic physiology exchange with HumMod

The exact synchronization interval must be selected after benchmarking the HumMod runtime and identifying which coupled variables require breath-by-breath versus slower updates. Do not assume identical solver time steps.

## First end-to-end integration target

One synthetic moderate Berlin ARDS case should demonstrate:

1. Vent mechanics initialized from an explicit recruitability phenotype.
2. A HumMod replay trajectory attached by case/run ID.
3. Systemic snapshot visible alongside ventilator state.
4. PEEP change recorded in the Vent intervention timeline.
5. Replay provider either follows a trajectory that explicitly contains the intervention response or rejects unsupported physiologic feedback.
6. Provenance clearly distinguishes Vent-modeled, HumMod-derived, cohort-calibrated, and scenario-authored values.

## Licensing / distribution boundary

Before distributing upstream HumMod model files, executable components, or a derivative runtime with this project, verify the terms that apply to the exact upstream component and intended use. Keep the adapter implementation separate from upstream artifacts so the Vent repository does not require bundling HumMod merely to build or test.

## Definition of done for HumMod bridge v0.5B

- [ ] configurable mapper implemented
- [ ] exact-path mapping only
- [ ] model/source version metadata supported
- [ ] mapper tests for missing, invalid, and partial fields
- [ ] deterministic replay provider implemented
- [ ] replay provider refuses unsupported dynamic interventions
- [ ] one representative exported HumMod trajectory mapped end-to-end
- [ ] exact upstream revision and mapped variables documented
- [ ] no HumMod binary/model vendored unintentionally
