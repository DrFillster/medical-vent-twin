# HumMod Standalone Variable Map

This document records only HumMod source symbols that have been inspected directly in the pinned upstream source. It is intentionally conservative: a plausible name is not enough to become a normalized digital-twin field.

## Pinned upstream revision

- Repository: `riliescu/hummod-standalone`
- Revision: `8dab57e05631f779bf5020fe0dd51874d8ae98c1`
- Integration status: source-symbol mapping in progress; no HumMod executable or model files are vendored in this repository.

Changing the upstream revision requires re-verification of the source files and updating the manifest/tests.

## Verified direct mappings

| Normalized target | HumMod symbol | Defining source | Unit/status |
| --- | --- | --- | --- |
| `gasExchange.pao2MmHg` | `PO2Artys.Pressure` | `Structure/O2/PO2Artys.DES` | mmHg; direct |
| `gasExchange.paco2MmHg` | `CO2Artys.Pressure` | `Structure/CO2/CO2Artys.DES` | mmHg; direct |
| `gasExchange.ph` | `BloodPh.ArtysPh` | `Structure/AcidBase/BloodPh.DES` | pH; direct |
| `hemodynamics.heartRatePerMin` | `Heart-Rate.Rate` | `Structure/Heart/Heart-Rate.DES` | 1/min; direct |
| `hemodynamics.meanArterialPressureMmHg` | `SystemicArtys.Pressure` | `Structure/VascularCompartments/SystemicArtys.DES` | mmHg; direct; the same pressure is converted to `MeanBP(kPa)` in HumMod Wrapup |
| `hemodynamics.cardiacOutputLPerMin` | `CardiacOutput.Flow(L/Min)` | `Structure/Circulation/CardiacOutput.DES` | L/min; direct |

These symbols are represented in `src/hummod_standalone_manifest.js`. The manifest does **not** assume the shape of a future JSON export. An exporter/runtime adapter must explicitly bind the HumMod symbol to a concrete serialized source path.

## Verified symbols that are not yet normalized

### Oxygen saturation

- HumMod symbol: `PO2Artys.Sat(%)`
- Source: `Structure/O2/PO2Artys.DES`
- Source unit: percent
- Normalized target unit: fraction
- Status: **requires an explicit percent-to-fraction transform**

The current adapter intentionally performs no implicit unit conversion, so this value is not yet included in direct mappings.

### Right atrial pressure / CVP

- HumMod symbol: `RightAtrium.Pressure`
- Source: `Structure/VascularCompartments/RightAtrium.DES`
- Candidate normalized target: `hemodynamics.centralVenousPressureMmHg`
- Status: **semantic mapping pending**

The source model clearly exposes right atrial pressure. This project has not yet declared right atrial pressure and the normalized CVP field to be identical in every intended simulation context. That decision should be explicit rather than silently encoded.

### Whole-body oxygen use

- HumMod symbol: `O2Total.Outflow`
- Source: `Structure/O2/O2Total.DES`
- Candidate normalized target: `metabolism.oxygenConsumptionMlPerMin`
- Status: **source units require end-to-end verification**

`O2Total.Outflow` sums organ `O2Use` terms. It will not be normalized to mL/min until the source units of those terms and any relevant standard-condition convention are verified.

### Whole-body carbon-dioxide production

- HumMod symbol: `CO2Total.Inflow`
- Source: `Structure/CO2/CO2Total.DES`
- Candidate normalized target: `metabolism.co2ProductionMlPerMin`
- Status: **source units require end-to-end verification**

`CO2Total.Inflow` sums organ `OutflowBase` terms; the same source file explicitly converts expired liters using `CO2Tools.LitersToMols`. This is sufficient reason not to assume the normalized value is already mL/min.

## Timestamp ownership

`timestampSec` will be supplied by the HumMod execution/export envelope, not by inventing a physiological HumMod model symbol. Every replay row must therefore include an explicit execution timestamp in seconds, with the exporter version and pinned HumMod revision retained as provenance.

## Next verification targets

1. Determine the exact serialization/export shape produced by the selected HumMod runner.
2. Verify oxygen-saturation transformation and add an explicit transform mechanism rather than implicit conversion.
3. Decide whether normalized CVP is represented by `RightAtrium.Pressure` or by another explicitly defined venous-pressure quantity.
4. Trace `O2Total.Outflow` and `CO2Total.Inflow` units through their component structures before exposing VO2/VCO2.
5. Produce a real HumMod trajectory export and use it as the first deterministic replay dataset; do not substitute a hand-authored physiologic trajectory and call it HumMod data.
