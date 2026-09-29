# Provenance Standard

Schema target: `vent-model-provenance/v1`

## Requirement

Every physiologically meaningful model element must carry provenance. This includes constants, defaults, state variables, equations, branch conditions, thresholds, interpolation rules, initialization values, scenario values, and derived outputs.

## Classification

Allowed `class` values:
- `HUMMOD_EXACT`
- `HUMMOD_ADAPTED`
- `LITERATURE_DIRECT`
- `LITERATURE_CALIBRATED`
- `ENGINEERING_ASSUMPTION`
- `SCENARIO_AUTHORED`
- `MEASURED_OR_USER_SUPPLIED`
- `DERIVED`
- `UNKNOWN`

`UNKNOWN` is migration-only and prohibited in release-gated live clinical physiology.

## Required fields

Each registry record must include:
- `id`: stable unique identifier.
- `kind`: variable | constant | equation | condition | transition | boundary | topology | interpolation | scenario.
- `class`.
- `module`.
- `symbol`: code symbol or logical field.
- `description`.
- `source`: one or more source descriptors, or an explicit engineering/scenario statement.
- `clinicalValidation`: boolean.
- `notes`: optional limitations.

HumMod records must also include repository, pinned revision, source path, and source symbol/structure where available.

Literature records must include a complete citation and the role of the citation. A citation may support an anchor without supporting the project's interpolation between anchors; interpolation must be separately tagged.

Derived records must list `dependsOn` provenance IDs.

## Conditions and transitions

Conditions are first-class provenance objects. Examples:
- hypoxemia reflex activation;
- hypercapnia reflex activation;
- Popen/Pclose recruitment branches;
- shock-stage transitions;
- PEA trigger conditions;
- minimum feasible recruitment projection;
- Berlin oxygenation category lookup.

A condition must identify whether its threshold/rule is source-preserved, literature-direct, calibrated, or engineered.

## Composite functions

A function can have mixed provenance. Do not assign one broad label to an entire function if its components differ. Example: an autonomic controller may contain literature-calibrated HCA endpoints and engineering-assumption reflex gains.

## Runtime exposure

Every clinical session snapshot should expose:
- model provenance schema/version;
- active provenance IDs by subsystem;
- active scenario-authored assumptions;
- native-HumMod calibration status;
- whether any UNKNOWN provenance is active.

Session export should preserve the same provenance IDs so results remain auditable after code changes.

## Release gates

For the live clinical path:
1. zero UNKNOWN records;
2. every numeric literal affecting physiology either declared in the registry or explicitly derived from tagged inputs;
3. every branch threshold/condition affecting physiology registered;
4. every model output traceable to dependency IDs;
5. source revision pinned for HumMod-derived records;
6. literature citations verified;
7. synthetic assumptions visibly distinguishable from measured or source-derived values.

## Naming

Prefer stable semantic IDs, e.g.:
- `hummod.breathing.dead_space_slope`
- `vent.recruitment.open_pressure.moderate`
- `live.thorax.reference_pleural_pressure`
- `autonomic.baroreflex_gain`
- `decompensation.pea.low_map_20_duration`

Do not encode line numbers in IDs.