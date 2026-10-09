# v1.3 native HumMod run07 protocol

## Objective

Resolve the native myocardial-collapse sequence at higher time resolution before changing reduced-model physiology.

The run06 challenge is preserved. Only observation density changes.

## Scenario

Use:
`hummod-runner/native-v13-myocardial-collapse-probe.json`

The assignments are identical to run06:
- ventilator on
- RR 4/min
- tidal volume 100 mL
- inspired O2 20%
- inspired N2 80%
- no inspired CO2, CO, or anesthetic

Do not change these values for run07.

## Native execution

Use the pinned native HumMod executable and source snapshot already used for run06.

The existing export script now supports an opt-in one-second step mode while retaining the old five-minute default.

For the high-resolution diagnostic run, use:
- `AdvanceMenuLabel = '1 Sec'`
- repeated advances sufficient to pass the prior run06 terminal time
- preserve the full resulting SOLN without editing

The exporter status file must record the selected menu label, count, and inter-step delay.

## Required native variables

At minimum retain:
- `System.X`
- `Heart-Rate.Rate`
- `CardiacOutput.Flow`
- `SANode-Rate.Rate`
- `SANode-Rate.Is_SinusRhythm`
- `Heart-Asystole.Is_Asystole`
- left/right myocardial PCO2
- left/right myocardial lactate
- left/right myocardial SID
- left/right myocardial pH
- left/right myocardial PhEffect
- left/right myocardial FuelEffect
- left/right myocardial total Function.Effect
- left/right myocardial Function.Failed

The v1.3 native diagnostic roster contains these symbols.

## Analysis

Run:
`node scripts/analyze-v13-native-myocardial-collapse.js <native-all-variables.json> <analysis.json>`

The analyzer must remain descriptive. It may identify event ordering and relative changes. It must not infer a new causal equation from one trajectory.

## Acceptance evidence

Return:
1. untouched native SOLN;
2. lossless all-variable extraction;
3. scenario assignment verification;
4. exporter status/diagnostics;
5. myocardial-collapse analyzer JSON;
6. source-equation replay JSON against the high-resolution native states;
7. a compact checkpoint CSV covering at least the final 30 seconds before native asystole;
8. source commit and executable hash.

## Decision rule

Do not modify the reduced model's myocardial metabolism or arrest timing until this run resolves the source-native sequence adequately.

If native HumMod and the reduced model differ, fix the port first.

If native HumMod itself appears clinically implausible, document that separately and test it later against external evidence. Do not silently retune HumMod-derived physiology.

## Clinical-scenario phase

After source fidelity is acceptable, run the model through the planned ARDS and critical-care scenarios for first-look plausibility. These scenarios evaluate the model; they do not define HumMod physiology.


## Deterministic post-processing

After the Mac native execution has produced an untouched `Vent.SOLN` and
`native-export-status.json` in a fresh run directory, process the evidence with:

```bash
cd ards-twin-v1.0
npm run native:run07:postprocess -- /path/to/run07-output
```

This command does not run HumMod and does not modify the SOLN. It:
- performs an all-variable strict numeric extraction to `native-all-variables.json`;
- preserves the original numeric tokens alongside the parsed numeric arrays;
- verifies the run07 scenario assignments against the exported native state;
- requires the pinned HumMod revision, `1 Sec` advance mode, 180 advances, and 250 ms delay in exporter status;
- requires the exported trajectory to pass the prior 153.365933 s terminal time;
- runs the myocardial-collapse analyzer;
- replays the source-aligned myocardial equations against every high-resolution native state;
- writes the final-30-second checkpoint CSV;
- writes source/executable/SOLN hashes;
- fails if any required run07 artifact is missing or empty.

The post-processor is evidence handling only. It does not infer physiology or tune
the reduced model.
