# v1.3 native HumMod autonomic trace handoff

Purpose: generate the native HumMod autonomic trace needed to localize the v1.21/v1.3 HR ceiling. Do not tune gains or alter physiology.

## Source branch
`v1.3`

## Native challenge
Use:
`ards-twin-v1.0/hummod-runner/native-v13-autonomic-extremis-probe.json`

This matches the browser extremis challenge where native HumMod permits:
- ventilator rate 4/min
- tidal volume 100 mL
- gas-tank O2 20%, N2 80%
- no native PEEP equivalent is available in this pinned HumMod ventilator

## Required native symbols
Track all symbols returned by:
`src/hummod_v13_autonomic_native_symbols.js`

Especially:
- Brain-Fuel.FractUseDelay
- Brain-Function.Effect
- A2Pool.Log10Conc
- SympsCNS.FuelEffect
- SympsCNS.A2Effect
- SympsCNS.ReflexNA
- SympsCNS.NA
- SympsCNS.NA(Hz)
- GangliaGeneral.NA(Hz)
- VagusNerve.NA(Hz)
- BetaPool.Effect
- SANode-BetaReceptors.Activity
- SANode-Rate.ParasympatheticEffect
- SANode-Rate.SympatheticEffect
- SANode-Rate.Rate
- Heart-Rate.Rate

## Output
Save the native solution/export without overwriting prior artifacts. Convert it through the existing native solution parser so `nativeSolution.autonomicDiagnostics` is populated.

Generate the reduced trace:
```sh
cd ards-twin-v1.0
npm run trace:v1.3-autonomic
```

Then compare:
```sh
node scripts/compare-v13-autonomic-traces.js <native-json> V1_21_EXTREMIS_AUTONOMIC_TRACE.json V1_3_NATIVE_VS_REDUCED_AUTONOMIC.json
```

Return these files/commit them to the v1.3 branch:
- native HumMod export/converted JSON
- V1_21_EXTREMIS_AUTONOMIC_TRACE.json
- V1_3_NATIVE_VS_REDUCED_AUTONOMIC.json
- native execution status/diagnostics

Do not change v1.0. Do not use GitHub Actions unless absolutely necessary.
