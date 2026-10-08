# v1.3 Native HumMod Myocardial Failure Audit

## Recovered run06 finding

Source artifact:
`hummod-v1.3-native-run06-raw-data-analysis-20261008.zip`

The native HumMod trajectory reaches terminal loss of cardiac output at 153.365933 s from initialization.

At the terminal native sample:
- Heart-Rate.Rate = 0 /min
- CardiacOutput.Flow = 0 mL/min
- SystemicArtys.Pressure = 63.213025 mmHg
- SANode-Rate.Rate remains about 72.08 /min
- Heart-Asystole.Is_Asystole changes to true
- SANode-Rate.Is_SinusRhythm changes to false
- LeftHeart-Function.Failed changes to true
- RightHeart-Function.Failed changes to true
- LeftHeart-Ph.Ph is about 6.61
- RightHeart-Ph.Ph is about 6.43
- arterial pH remains about 7.36

## Source mechanism

Pinned reproducibility source:
`riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1`

HumMod defines:

1. `Heart-Asystole.Is_Asystole = LeftHeart-Function.Failed`.
2. Left/right myocardial function effect is the product of:
   - local myocardial pH effect;
   - protein effect;
   - fuel effect;
   - temperature effect;
   - structural effect.
3. The myocardial pH curve is 0 at pH 6.6 and 1 at pH 6.7.
4. Failure latches when total function effect is below 0.2.
5. Failure clears only when total function effect rises above 0.4.

Therefore the run06 terminal state is consistent with source-native myocardial functional failure and asystole despite a still-computed SA-node rate.

## Modeling consequence

Do not correct this behavior by increasing sympathetic or SA-node gain.

Do not substitute arterial pH for myocardial intracellular pH.

The reduced model can use the source-aligned myocardial failure module only when local myocardial pH/fuel/structure state is available from:
- native HumMod trajectory input; or
- a source-aligned myocardial metabolism/acid-base port.

Until then, the module is diagnostic and integration-gated.

## v1.3 implementation

Added:
- `src/hummod_ards_heart_function_source_aligned.js`
- focused source-threshold tests
- native tracing for myocardial pH, myocardial function, failure latches, sinus-rhythm state, and asystole

This preserves the project rule that native HumMod is the physiological authority and engineering bridges must not silently replace unavailable source state.
