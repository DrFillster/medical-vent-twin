# HumMod trajectory export discovery

Status: active integration investigation  
Pinned upstream: `riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1`

## Confirmed from the pinned source

The standalone model includes:

- `HumMod.DES` -> `Model.DES` -> Context, Structure, Control, Display
- `Control/GoFor.DES` execution presets with separate:
  - `solutionint`
  - `displayint`
  - `storageint` on longer-duration presets
- display panels that graph exact model variables against `System.X`
- display panels that expose the exact verified variables currently used by Vent, including:
  - `Heart-Rate.Rate`
  - `BloodPh.ArtysPh`
  - `CO2Artys.Pressure`
- display definitions are presentation surfaces; they are not themselves an export API

Examples verified in the pinned tree:

- `Display/Clinic/Chart/HeartRate.DES` graphs `Heart-Rate.Rate` against `System.X`
- `Display/Physiology/AcidBase/ArterialPh.DES` exposes `BloodPh.ArtysPh` and `CO2Artys.Pressure`
- `Control/GoFor.DES` defines storage intervals for longer runs

## What is not yet verified

The repository does not expose an obvious source-level command for:

- CSV export
- JSON export
- save-series
- clipboard export
- batch/headless output

Repository code search for export/save/CSV/recording terminology did not identify a documented exporter.

The checked-in `HumMod.EXE` is a Windows binary. The repository connector cannot decode binary contents, so no claim is made about undocumented executable menus or export features.

## Important clock/unit boundary

Vent's canonical HumMod trajectory contract uses `timestampSec`.

HumMod display definitions use `System.X`, and GoFor presets encode execution intervals. The exact unit semantics of `System.X` must be verified against HumMod runtime/documentation before any exporter converts it to seconds.

Do not infer or hard-code a time conversion from menu labels alone.

## Export path decision tree

### Path A — native runtime export

Use this only if the standalone executable or its documented runtime exposes a reproducible time-series export.

Required output metadata:

- upstream repository
- exact upstream revision
- exporter/runtime version
- exact source symbols
- raw runtime clock values and verified clock units
- sample interval
- trajectory ID
- run/scenario metadata

The exported series is then converted to `vent-hummod-trajectory/v1` without changing source-symbol identity.

### Path B — instrumented research runner

If no native exporter exists, use a separate runner around a legally permitted HumMod runtime/source configuration.

The runner must:

1. pin the exact HumMod revision;
2. request only verified source symbols;
3. preserve raw source values;
4. verify runtime clock semantics before producing `timestampSec`;
5. record every intervention and scenario input;
6. emit the canonical Vent export schema;
7. fail on missing symbols rather than substituting nearest names.

This runner belongs outside the browser.

## First target trajectory

The first useful end-to-end trajectory remains:

`berlin-moderate-moderate-aspiration`

The purpose is not to make that case an archetypal ARDS patient. It is simply the first integration reference for:

- deterministic systemic replay
- shared Vent/HumMod timeline
- provenance display
- later live-coupling work

No synthetic values should be labeled HumMod-derived until a real runtime export exists.

## Next verification targets

1. Identify any official HumMod runtime/user documentation describing stored-series export.
2. Verify the units and reset/initialization semantics of `System.X`.
3. Determine whether the standalone executable supports reproducible scripted/batch execution.
4. If not, define the minimum external runner interface without vendoring HumMod assets.
5. Re-check licensing/redistribution terms before distributing any HumMod runtime or modified upstream files.
