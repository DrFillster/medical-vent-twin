# Shimayoshi respiratory-acidosis source result

Date: 2026-10-11
Pinned upstream commit: `6478d2ab0acbfc88d3da461d2594658bcb2798ca`
Validated extraction run: GitHub Actions run `38151204764`

## Source protocol

The pinned source model defines extracellular CO2 as percent:

```cpp
double CO2o_p = 5.0;   // extracellular CO2 %
double CO2o_p2 = 30.0; // respiratory acidosis
```

Challenge timing:
- 0-300 s: control
- 300-900 s: respiratory acidosis
- >900 s: recovery

The long trajectory used 0.2 ms external CVODE target/output cadence after
independent validation against the source 0.1 ms cadence through 320 s.

Challenge-onset cadence comparison:
- phase mismatches: 0
- peak Fb maximum relative error: 9.96e-7
- pHi maximum relative error: 1.66e-9
- peak cytosolic Ca maximum relative error: 3.02e-6

## Source force result

Control reference mean peak Fb:

```
6.041059088461671 mN/mm^2
```

Respiratory-acidosis phase:
- mean peak Fb: 5.4832725716034725 mN/mm^2
- mean stress ratio: 0.9076674290566753
- force nadir: 5.274450300352583 mN/mm^2 at 401.2 s
- nadir stress ratio: 0.8731002665454309
- pHi at force nadir: 6.766682956386523

Minimum intracellular pH:
- pHi: 6.744957152474442 at 490 s
- peak Fb: 5.3470210142670584 mN/mm^2
- stress ratio: 0.885113178992039

End of challenge:
- 899.6 s: peak Fb 5.65007928801818 mN/mm^2
- stress ratio 0.9352795934093318
- pHi 6.779433159609797

Recovery:
- 930 s: stress ratio 0.9914313026829535
- 960 s: stress ratio 1.0243421890653606
- 960 s pHi: 6.965779279647219

## Interpretation for the Vent model

This source trajectory supports a real acidosis-related myocardial-depression
mechanism. It does **not** support a monotonic bedside rule such as
`arterial pH -> contractility multiplier`.

The source response is time-dependent and state-dependent:
- active force falls by approximately 13% at its nadir;
- the minimum pHi and minimum force do not occur at the same time;
- active force begins recovering before intracellular pH fully normalizes;
- early recovery includes a modest force overshoot.

Therefore the browser surrogate must target source `Fb` from source-model
myocardial state variables. It must not be fit directly to arterial pH,
PaCO2, HR, MAP, CO, SV, or SVR.

## Primary whole-heart use

Validated source `Fb`
-> published Kato/Utaki cell-to-wall scaling
-> active + passive LV wall stress
-> LV pressure
-> closed-loop circulation

CircAdapt/TriSeg remains an independent shadow/comparison path.
