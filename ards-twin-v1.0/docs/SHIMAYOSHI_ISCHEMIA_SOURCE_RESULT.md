# Shimayoshi ischemia-reperfusion source result

Date: 2026-10-11
Pinned upstream commit: `6478d2ab0acbfc88d3da461d2594658bcb2798ca`
Validated extraction run: GitHub Actions run `38151619812`

## Validated source trajectory

Protocol:
- 0-180 s: control
- 180-1080 s: source ischemia
- >1080 s: source reperfusion

The 0.2 ms extraction cadence was independently compared with the source 0.1 ms
cadence through ischemia onset:
- phase mismatches: 0
- peak Fb maximum relative error: 9.32e-7
- pHi maximum relative error: 6.51e-10
- intracellular O2 maximum relative error: 2.88e-9

## Important source result

Control reference peak Fb:

```
6.041059088461671 mN/mm^2
```

During ischemia:
- minimum peak Fb: 3.0678890784981516 mN/mm^2 at 515.6 s
- force ratio at nadir: 0.5078396078524993
- pHi at force nadir: 6.715628490507644
- ATP total: 6.693578077940684 mM
- PCr: 1.5946747553242009 mM
- Pi: 7.5777683560013855 mM

Late ischemia is qualitatively different:
- at 1079.6 s peak Fb is 18.360275837919154 mN/mm^2
- stress ratio is 3.0392478486077046
- pHi is 6.465884155038551
- ATP total is only 0.33648765859134755 mM
- PCr is 0.0065443711387072195 mM
- Pi is 15.415984856876808 mM

Early reperfusion remains highly force-loaded:
- at 1080.4 s peak Fb is 18.3849222938548 mN/mm^2
- stress ratio is 3.043327672290065
- pHi is 6.465410421472107
- ATP total is 0.3226376180381409 mM

At 1200 s:
- peak Fb remains 9.397538968946105 mN/mm^2
- stress ratio remains 1.5556111654155576
- ATP total is 2.9680188233192912 mM
- PCr remains 0.1445347184807268 mM

## Modeling consequence

**Peak Fb alone must not receive whole-heart pumping authority for severe
ischemia/reperfusion.**

The source mechanics use a fixed external load:

```cpp
const double ExternalLoad = 5.0;
dY[IDX_hsmL] = (ExternalLoad - (Fb + Fp)) / c_hsm;
```

Therefore a high late-ischemic/reperfusion `Fb` can coexist with severe energy
failure and may represent tonic contracture/Ca-overload mechanics rather than
useful cyclic shortening or ventricular ejection capability.

The source does provide a substantial mid-ischemic depression candidate
(~49% loss of peak active force), but the complete severe-ischemia adapter must
also evaluate half-sarcomere shortening/length mechanics before mapping source
state to ventricular pressure.

## Required next extraction

Add, per paced cycle:
- start half-sarcomere length `hsmL`
- minimum `hsmL`
- maximum `hsmL`
- end-cycle `hsmL`
- end-cycle cross-bridge position `hsmX`

Derived diagnostic quantities:
- cycle hsmL excursion
- peak shortening from cycle start
- net cycle hsmL change

The severe-ischemia source path remains shadow-only until useful cyclic
shortening can be distinguished from contracture.
