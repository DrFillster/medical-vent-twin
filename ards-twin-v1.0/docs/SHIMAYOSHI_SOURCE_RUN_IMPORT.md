# Shimayoshi source-run import contract

Date: 2026-10-10
Status: implemented fail-closed intake boundary

## Purpose

This boundary imports source-model cellular output without converting arterial pH,
PaO2, MAP, HR, CO, SV, or SVR into myocardial contractility.

The accepted pathway is:

```
Shimayoshi source run
  -> compact cycle CSV
  -> authenticated run manifest
  -> control peak-Fb reference
  -> source stress_ratio
  -> myocardial_lv_pressure_shadow.js
  -> kato_utaki_lv_bridge.js
```

## Required CSV schema

The header must exactly match:

```
time_s,protocol,peak_Fb_mN_per_mm2,end_cycle_pHi,end_cycle_ExtCell_O2o_mM,end_cycle_O2i_mM,end_cycle_ATPTotal_mM,end_cycle_PCr_mM,end_cycle_Pi_mM,peak_Cyt_Cai_mM
```

All numeric fields must be finite. Time must increase strictly within each file.
Imported paced-cycle peak Fb must be nonnegative. The control reference mean peak Fb must remain positive.

## Required manifest schema

Each source-run manifest must contain:

- `upstreamGitSha`
- `compilerBuildEnvironment`
- `exactCodeDiff`
- `simulationDuration`
- `protocolEnabled`
- `outputCadence`
- `cvodeTargetCadenceMs`
- `protocolName` (`control`, `ischemia`, or `acidosis`)
- `physiologyChanged`

The importer validates the observed native phase sequence and transition timing against `protocolName`.

The import is rejected unless:

```json
"physiologyChanged": false
```

## Normalization

The importer requires **two independently authenticated source runs**:

1. a control-reference CSV plus its control manifest;
2. a challenge CSV plus its challenge manifest.

Both manifests must identify the pinned upstream commit
`6478d2ab0acbfc88d3da461d2594658bcb2798ca`. The control manifest must
declare `protocolName: "control"`. A valid challenge manifest does not make
an unrelated control-reference CSV trustworthy.

The browser-side import computes only:

```
reference_peak_Fb = mean(control cycle peak_Fb)
stress_ratio = challenge cycle peak_Fb / reference_peak_Fb
```

No bedside hemodynamic variable participates in this normalization.

The absolute `peak_Fb_mN_per_mm2` remains available and is the quantity passed to
the Kato/Utaki pressure bridge when a source cycle is selected.

## Current limitation

This code does not create source physiology. It remains blocked until the actual
Shimayoshi source-model CSV and manifest artifacts are generated and imported.


## Source meaning of Fb

At pinned upstream commit `6478d2ab0acbfc88d3da461d2594658bcb2798ca`,
`model.cpp` defines the contractile force term as:

```cpp
Fb = A_Fb * (TrnCa_cb + Trn_cb) * SF_CNTR2 * (hsmL - hsmX);
```

The same source separately includes passive elastic force `Fp` in the
half-sarcomere mechanics:

```cpp
dY[IDX_hsmL] = (ExternalLoad - (Fb + Fp)) / c_hsm;
```

Therefore the imported `peak_Fb_mN_per_mm2` is treated as the source
**active cross-bridge contractile force**. It is not total myocardial wall
stress and does not include the source passive elastic component.

The LV bridge must keep its own passive wall term separate from this imported
active source quantity.

## CLI contract

```text
npm run shimayoshi:import -- \
  control.csv control-manifest.json \
  challenge.csv challenge-manifest.json \
  output.json
```

The importer fails closed if either manifest is missing, if either source SHA
differs from the pinned source, if the control manifest is not a control run,
or if the observed phase sequence does not match the declared challenge
protocol.


## CVODE target cadence provenance

`cvodeTargetCadenceMs` records the external CVODE target/output-request cadence
used by the patched source executable. It is not described as the internal
adaptive solver step.

The pinned upstream default is 0.1 ms. A 0.2 ms candidate cadence is permitted
only for source extraction with explicit fidelity comparison against a 0.1 ms
reference. The cadence value must be carried in the source-run manifest and
must never be hidden or inferred.
