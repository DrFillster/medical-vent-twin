# v1.2 Heart-Rate Response Audit

## Observed issue

During severe deterioration, displayed HR does not rise as much as expected.

## HumMod source chain

The relevant source path is:

`RegionalPressure.Carotid -> CarotidSinus.Pressure -> Baroreflex -> SympsCNS -> VagusNerve / SANode-BetaReceptors -> SANode-Rate -> Heart-Ventricles.Rate -> Heart-Rate.Rate`

For sinus rhythm, HumMod's `Heart-Ventricles.Rate` follows `SANode-Rate.Rate`. Asystole/VF are handled as separate terminal states.

## Finding 1 — source SA-node response is present

The current v1.2 source-aligned controller already raises `heartRatePerMin` during hypotension in unit/comparison tests. Therefore the HumMod-derived baroreflex/SA-node pathway itself is capable of tachycardia.

## Finding 2 — displayed HR is post-multiplied by a project-authored factor

The cardiopulmonary runtime currently computes:

`effectiveHeartRatePerMin = sourceSaNodeHeartRatePerMin * chronotropicReserveMultiplier`

The multiplier comes from the project decompensation controller's asphyxial-collapse bridge.

No equivalent global chronotropic-reserve multiplier was identified in the HumMod heart-rate chain. HumMod instead uses separate heart-function failure/asystole/VF logic.

This makes the project multiplier a strong candidate explanation for blunted displayed HR.

## Finding 3 — HumMod low-pressure receptors are omitted

HumMod `SympsCNS` multiplies:

`BaroEffect * LowPressureEffect * MechanoEffect * SympsChemo.Effect`

In this source snapshot:
- `Mechanoreceptors.FiringRate = 0`
- `SympsChemo.Effect = 1.0`
- `LowPressureReceptors` is dynamic and depends on average atrial transmural pressure:
  `(RightAtrium.TMP + LeftAtrium.TMP)/2`

The current v1.2 source-aligned controller neutralizes `LowPressureReceptors`.

That omission is particularly relevant when PEEP or shock reduces cardiac filling.

## Recommended correction sequence

1. **Do not tune baroreflex gains.**
   There is no evidence that arbitrary gain inflation is justified.

2. **Instrument before authority change.**
   Export and trend:
   - HumMod SA-node HR
   - effective/displayed HR
   - chronotropic-reserve multiplier
   - right/left/average atrial TMP

3. **Remove the project chronotropic multiplier from pre-arrest sinus HR if testing confirms it is suppressing the HumMod response.**
   Preserve HR=0 only for explicit arrest/asystole/VF-equivalent terminal states.

4. **Port HumMod LowPressureReceptors next.**
   The reduced circulation already exposes atrial pressure and pericardial pressure, so atrial TMP can be reconstructed without inventing a new signal.

## What should not be done

- Do not invent a larger sympathetic gain.
- Do not create a chemoreflex tachycardia path from `Chemoreceptors`; in this HumMod snapshot `SympsChemo.Effect` is fixed at 1.0.
- Do not replace HumMod's SA-node curves with empirical hand tuning simply to make HR "look better".


## Implemented correction

v1.2 now:

- preserves the HumMod baroreflex delay using the source minute-based time semantics: `RateConst = 1/(60*10)` corresponds to a 600-minute (10-hour) adaptation constant;
- ports `LowPressureReceptors` from average right/left atrial transmural pressure and feeds `SympsCNS.LowPressureEffect` into the reflex product;
- leaves `Mechanoreceptors.FiringRate = 0` and `SympsChemo.Effect = 1.0` as represented in the pinned source snapshot;
- uses `SANode-Rate` directly as pre-arrest sinus HR;
- no longer multiplies pre-arrest sinus HR by the project-authored asphyxial `chronotropicReserveMultiplier`;
- retains explicit terminal arrest behavior, where PEA/asystole-equivalent state sets HR and cardiac output to zero.

The legacy chronotropic reserve value remains export-visible only as a diagnostic while the decompensation controller is being further separated from HumMod cardiac-rate authority.

## Remaining reduced-CNS limitation

After the source timebase, low-pressure reflex, pre-arrest HR authority, and dynamic catecholamine corrections, the reduced v1.2 CNS still does not execute two HumMod inputs that can amplify `SympsCNS.NA`:

- `Brain-Fuel.FractUseDelay`, which feeds the additive `FuelEffect`;
- `A2Pool.Log10Conc`, which feeds the multiplicative `A2Effect`.

The current reduced runtime lacks HumMod's brain-flow/substrate metabolism and renin-angiotensin state required to calculate those quantities. They are therefore not replaced by PaO2, MAP, oxygen debt, or another heuristic proxy.

For the authored reference patient, catecholamine dynamics now use HumMod's checked-in resting benchmark ECFV of 15,000 mL when native `ECFV.Vol` is unavailable. Native ECFV still takes precedence.

This means persistent under-tachycardia after these corrections should be interpreted as a limitation of the reduced HumMod CNS path, not as justification to increase sympathetic or SA-node gains by hand.
