# Shimayoshi respiratory-acidosis mechanism map

Date: 2026-10-11
Pinned upstream commit: `6478d2ab0acbfc88d3da461d2594658bcb2798ca`

## Source protocol

The source respiratory-acidosis protocol changes extracellular CO2 partial
pressure only during the challenge interval:

```cpp
double CO2o_p2 = 30.0;

if (t >= t_AsidosisOn && t < t_Recovery2On) {
    flagAsidosis = 1;
    CO2o_p = CO2o_p2;
} else {
    flagAsidosis = 0;
    CO2o_p = 5.0;
}
```

Source timing:
- challenge on: 300 s;
- recovery on: 900 s.

No Vent HR/MAP/CO/SV/SVR variable enters this protocol.

## Intracellular acid-base pathway

The model computes cytosolic pH from intracellular hydrogen concentration:

```cpp
Cyt_pHi = -log10(Cyt_Hi / 1000);
```

CO2 hydration contributes directly to the intracellular H balance:

```cpp
J_hyd = AF *
  (khyd_plus * Cyt_CO2i - khyd_minus * Cyt_HCO3i * Cyt_Hi) *
  SF_CO2Hyd;

dY[IDX_Hi] =
  ((Flux_CHE - Flux_NHE) / Vi
   + V_Cyt_CO2Hyd
   - (dATP_CK + HFromMit + dATPUse - H_Metab + VHeff))
  / buffers;
```

The source also contains NHE, bicarbonate/chloride exchange, mitochondrial H
handling, ATP-linked proton terms, and metabolic proton terms.

## pH-sensitive excitation-contraction coupling

The source uses `Cyt_pHi` in multiple transport/Ca-handling equations,
including NCX, Na/K ATPase, SERCA, and RyR pH factors.

Examples:

```cpp
pHFactor =
  (1 + pow(10, nNCX * (-pHref + pKNCX))) /
  (1 + pow(10, nNCX * (-Cyt_pHi + pKNCX)));

pHFactor =
  FunpHref * pHFactor1 * pHFactor2;
ISERCA = ... * pHFactor;

pHFactor =
  (1 + pow(10, nrel * (-pHref + pKrel))) /
  (1 + pow(10, nrel * (-Cyt_pHi + pKrel)));
```

## Active contractile output

The imported mechanical target is the source active cross-bridge force density:

```cpp
Fb =
  A_Fb *
  (TrnCa_cb + Trn_cb) *
  SF_CNTR2 *
  (hsmL - hsmX);
```

with:

```cpp
A_Fb = 1.8E6; // mN/mm^2/um/mM
```

`Fb` is distinct from passive force `Fp`.

## Interpretation rule

The respiratory-acidosis trajectory is therefore interpreted as a native
source response:

```
extracellular CO2 challenge
  -> intracellular acid-base state
  -> pH-sensitive ion/Ca/energy processes
  -> cross-bridge state
  -> source Fb
```

No direct arterial-pH-to-contractility multiplier is introduced.
