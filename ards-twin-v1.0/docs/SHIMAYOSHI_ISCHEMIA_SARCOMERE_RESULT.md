# Shimayoshi ischemia sarcomere-mechanics result

Date: 2026-10-11

Pinned upstream:
`atakeuti/TS-AT-SM-2026-IRmodel@6478d2ab0acbfc88d3da461d2594658bcb2798ca`

Validated mechanics extraction:
- GitHub Actions run: `38167611130`
- 0.2 ms full ischemia/reperfusion trajectory
- native 0.1 ms onset-reference cross-check
- importer validation passed
- optional hsmL mechanics fields present

## Control mechanics

At 0.4 s:

```
peak Fb                 6.041059931 mN/mm^2
start hsmL              1.041650838 um
minimum hsmL            0.936340465 um
end hsmL                1.041650838 um
cycle hsmL excursion    0.105388955 um
cycle peak shortening   0.105310373 um
net hsmL change         ~0
```

The control cycle therefore shows large cyclic shortening with essentially
complete return to its starting half-sarcomere length.

## Mid-ischemic myocardial depression

At the source force nadir, 515.6 s:

```
peak Fb                 3.067889078 mN/mm^2
stress ratio            0.507839608
pHi                      6.715628491
ATP total                6.693578078 mM
PCr                      1.594674755 mM
Pi                       7.577768356 mM

start hsmL              1.059266717 um
minimum hsmL            1.018224377 um
end hsmL                1.059267842 um
cycle hsmL excursion    0.041050890 um
cycle peak shortening   0.041042340 um
net hsmL change         0.000001124 um
```

This state shows both reduced active force and reduced—but still clearly
cyclic—shortening.

## Late ischemia

At 1079.6 s:

```
peak Fb                 18.360275838 mN/mm^2
stress ratio            3.039247849
pHi                      6.465884155
ATP total                0.336487659 mM
PCr                      0.006544371 mM
Pi                       15.415984857 mM
peak cytosolic Ca        0.003052888 mM

start hsmL              0.538416510 um
minimum hsmL            0.538018069 um
end hsmL                0.538018069 um
cycle hsmL excursion    0.000398441 um
cycle peak shortening   0.000398441 um
net hsmL change        -0.000398441 um
```

Despite very high `Fb`, cyclic shortening is nearly absent and the
half-sarcomere has collapsed to a markedly shorter length than control.

## Early reperfusion

At 1080.4 s:

```
peak Fb                 18.384922294 mN/mm^2
stress ratio            3.043327672
pHi                      6.465410421
ATP total                0.322637618 mM
PCr                      0.006374256 mM
Pi                       15.450087996 mM

start hsmL              0.537619949 um
minimum hsmL            0.537221167 um
end hsmL                0.537221167 um
cycle hsmL excursion    0.000398782 um
cycle peak shortening   0.000398782 um
net hsmL change        -0.000398782 um
```

The high-force / near-zero-cyclic-shortening phenotype persists immediately
after reperfusion.

## Later reperfusion

By 1200 s:

```
peak Fb                 9.397538969 mN/mm^2
stress ratio            1.555611165
pHi                      7.004460760
ATP total                2.968018823 mM
PCr                      0.144534718 mM

start hsmL              0.853323410 um
minimum hsmL            0.827813044 um
end hsmL                0.853523982 um
cycle hsmL excursion    0.026462895 um
cycle peak shortening   0.025510366 um
net hsmL change         0.000200571 um
```

Cyclic shortening is recovering, but the mechanical state remains far from the
control source cycle.

## Interpretation

The source mechanics directly resolve the prior ambiguity:

**Late ischemic/reperfusion high Fb is not evidence of preserved or
supranormal pumping.**

Under the source fixed external load,

```
d(hsmL)/dt = (ExternalLoad - (Fb + Fp)) / c_hsm
```

Late ischemia shows:
- high active force;
- severe ATP/PCr depletion;
- marked persistent half-sarcomere shortening;
- almost no cyclic shortening excursion.

This is a contracture-dominant source phenotype.

No empirical threshold is introduced from these data.

## Independent replication

A second source extraction was run independently after the mechanics-patcher
fail-open defect was fixed:

- replication workflow run: `38168207011`
- simulation endpoint: 1140 s
- shared interval with the canonical 1200-s run: 0.4-1140 s
- shared paced cycles: 2850

Every shared cycle matched exactly for:

- stress ratio;
- shortening ratio;
- cycle peak shortening;
- start/min/max/end `hsmL`;
- ATP total;
- PCr;
- Pi;
- pHi;
- peak cytosolic Ca.

Maximum absolute and relative differences across the shared cycles were zero
for all compared fields.

This independently reproduces the late high-force / near-zero-shortening
mechanical phenotype.

## Modeling consequence

1. Peak `Fb` alone must never drive whole-heart pumping authority in severe
   ischemia/reperfusion.
2. The mid-ischemic depressed-force state remains useful source evidence of
   myocardial depression.
3. A whole-heart severe-ischemia bridge must preserve both active-force and
   mechanical-state information; multiplying `Fb` by an invented shortening
   correction is not permitted.
4. The ischemia path remains shadow-only until a published or source-derived
   wall/chamber formulation can consume the relevant mechanical state without
   an empirical bedside fit.
