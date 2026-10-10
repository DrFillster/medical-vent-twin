# v1.5 Step 6 — Full Autonomic Shadow Validation

Date: 2026-10-10
Branch: `v1.5`
Decision: **NO ACTIVATION**

## What was run

The published Ursino/Magosso 2000 O2/autonomic shadow states were replayed against the existing native HumMod run07 autonomic trajectory.

Native source artifact:
`artifacts/v1.3/native-autonomic-20261009-run07/run07-native-chain-trace.json`

Native challenge:
`hummod-runner/native-v13-myocardial-collapse-probe.json`

Native ventilator tidal volume for the challenge: 0.1 L.

The comparison used all 157 native samples. The published shadow controller remained non-authoritative.

## Results

Before CNS failure:
- 134 native samples were available from the challenge baseline through the last sample with Brain-Function.Effect > 0.1.
- Ursino peripheral chemoreceptor firing vs native HumMod Chemoreceptors.FiringRate correlation: **0.9604347494**.
- Mean absolute difference: **1.3330469999 spikes/s**.
- Native peak SympsCNS firing: **2.0249753360 Hz**.
- Native minimum vagal firing: **1.1230648241 Hz**.
- Native peak SA-node rate / heart rate: **84.7105619854/min**.

At the first CNS-failure-like sample:
- time 137.999484 s;
- PaO2 15.4620435872 mmHg;
- Brain-Function.Effect 0.0979967586;
- native chemoreceptor firing 10.8735981633 spikes/s;
- Ursino peripheral chemoreceptor firing 12.7975477885 spikes/s;
- native SympsCNS returned to 1.5 Hz;
- native vagus returned to 2 Hz;
- native SA-node rate returned to 72.0834513354/min;
- Ursino theta_sp remained 7.9268610048 spikes/s;
- Ursino theta_sh was -46.7057163004 spikes/s.

At the native endpoint:
- PaO2 12.7735756082 mmHg;
- native HR 0/min;
- native SA-node rate remained 72.0793994184/min;
- Brain-Function.Effect 0.03490993699;
- Ursino peripheral chemoreceptor firing remained 13.0005707640 spikes/s.

## Interpretation

1. The published Ursino peripheral O2 afferent and native HumMod chemoreceptor pathways respond in the same direction and with strongly concordant time courses during progressive hypoxia.
2. The native downstream SympsCNS/SA-node response is much smaller than the afferent chemoreceptor change in this challenge.
3. When native Brain-Function fails, the native autonomic outputs move to the HumMod fallback branch while the published O2 afferent/CNS-hypoxia shadow states continue to represent profound hypoxia.
4. This identifies a controller-architecture difference; it does **not** justify adding a tachycardia gain.

## Why activation remains blocked

### Ursino f_ab

The published `f_sp`, `f_sh`, and `f_v` equations require baroreceptor afferent firing `f_ab` in spikes/s.

HumMod `Baroreflex.NA` has not been shown to be the same physical quantity. No fitted or guessed conversion is permitted.

Therefore:
- `f_sp`, `f_sh`, and `f_v` remain source-faithful functions;
- integrated shadow outputs remain null until a source-valid `f_ab` mapping is established.

### 2001 O2-CO2 interaction

Magosso/Ursino 2001 Eq. 1 remains blocked pending visual verification of the printed piecewise interaction coefficient.

No alternative CO2 gain is substituted.

## Vent VT coupling correction

The lung-stretch shadow now uses the **measured inspired VT from the last completed Vent breath** (`metrics.VtInspired`), not the current partial-breath accumulated volume and not the ventilator setting.

## Runtime harness

`scripts/v15-autonomic-shadow-suite.js` contains the repeatable browser/reduced-model perturbation suite:

- baseline;
- hypoxia;
- low-ventilation hypercapnia;
- combined hypoxic/hypercapnic stress;
- high-VT stretch challenge.

The harness writes `V1_5_AUTONOMIC_SHADOW_SUITE.json` and does not grant any controller output physiologic authority.

## Next gate

Before any activation:
1. establish a source-valid baroreceptor afferent mapping;
2. visually verify and transcribe 2001 Eq. 1;
3. enable the complete published O2/CO2 efferent controller in shadow mode;
4. repeat the native comparison across isolated hypoxia, isolated hypercapnia, combined stress, and recovery;
5. only then evaluate HumMod SA-node vs Ursino heart-period ownership.
