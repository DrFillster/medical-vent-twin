# Shimayoshi source-run extraction handoff

Date: 2026-10-10
Purpose: obtain source-model myocardial active stress trajectories for the Vent/HumMod published-model shadow.

## Non-negotiable rule

Do not change physiology, model equations, parameter values, channel/pump kinetics, buffering, mitochondrial equations, or contraction equations.

Allowed modifications are limited to:
- simulation duration;
- protocol compile switch;
- output path;
- output cadence;
- compact output variables.

## Upstream source

Repository:
`atakeuti/TS-AT-SM-2026-IRmodel`

Relevant files:
- `simulator/main.cpp`
- `simulator/model.cpp`
- `simulator/index.h`
- `simulator/Initial1.txt`

The source model is Windows/Visual Studio/CVODE oriented. Use its supplied CVODE build as-is if possible.

## Compact output

Write a CSV with one row per paced cycle:

```
time_s,
protocol,
peak_Fb_mN_per_mm2,
end_cycle_pHi,
end_cycle_ExtCell_O2o_mM,
end_cycle_O2i_mM,
end_cycle_ATPTotal_mM,
end_cycle_PCr_mM,
end_cycle_Pi_mM,
peak_Cyt_Cai_mM
```

Required index definitions from upstream `index.h`:

```
Y[35] = ATPTotal
Y[36] = PhosphoCreatine
Y[64] = O2i

v[4]   = Cyt_Cai
v[5]   = Cyt_pHi
v[9]   = ExtCell_O2o
v[82]  = PITotal
v[128] = Fb
```

## Protocol A: respiratory acidosis

Use the source respiratory-acidosis protocol exactly as implemented in `model.cpp`:

- baseline extracellular CO2 = 5%
- source challenge extracellular CO2 = 30%
- switch on the existing `USE_Acidosis_PROTOCOL`
- do not alter its CO2 value or any acid-base equation

For extraction efficiency, shorten only the total simulation window enough to include:
1. prechallenge control;
2. source acidosis interval;
3. postchallenge recovery.

If protocol timing itself must be shortened, scale only the control/challenge/recovery durations proportionally and record that this is a runtime-compressed protocol. Prefer retaining the published/source timing if feasible.

## Protocol B: ischemia / hypoxic myocardial failure

Use the existing `USE_ISCHEMIA_PROTOCOL` exactly.

The source implementation reduces extracellular O2 according to its native ischemia function. Do not replace this with arterial PaO2 or an invented O2 curve.

Record the full control -> ischemia trajectory through cessation of mechanical contraction.

## Cycle extraction

The upstream pacing interval is 400 ms.

For each pacing cycle:
- track maximum `v[IDX_Fb]`;
- track maximum `v[IDX_Cyt_Cai]`;
- at cycle end record pHi, extracellular O2, intracellular O2, ATP, PCr, and Pi.

Do not average peak force across arbitrary windows.

## Output files

Create:

```
shimayoshi_control_cycles.csv
shimayoshi_respiratory_acidosis_cycles.csv
shimayoshi_ischemia_cycles.csv
```

Also create:

```
SHIMAYOSHI_SOURCE_RUN.json
```

with:
- upstream git SHA;
- compiler/build environment;
- exact code diff from upstream;
- simulation duration;
- protocol enabled;
- output cadence;
- confirmation `physiologyChanged: false`.

## Validation before import

The source run is acceptable only if:
- control reaches a stable paced trajectory;
- respiratory acidosis lowers peak contraction despite the known increase in Ca transient;
- ischemia produces progressive energetic deterioration and eventually loss of contraction;
- no physiologic source parameter was modified;
- all compact outputs are finite until the source model itself enters its terminal/non-oscillatory state.

## Vent/HumMod import

The Vent repo must consume only the generated CSV/JSON outputs.

Fit target:

```
stress_ratio =
  cycle_peak_Fb /
  mean_prechallenge_cycle_peak_Fb
```

Never fit against:
- HR
- MAP
- CO
- SV
- SVR

The source stress then enters:

```
myocardial_lv_pressure_shadow.js
    ->
kato_utaki_lv_bridge.js
    ->
published-model LV pressure / later closed-loop circulation
```
