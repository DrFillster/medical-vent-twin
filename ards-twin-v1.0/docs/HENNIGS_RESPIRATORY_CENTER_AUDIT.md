# Hennigs 2026 Respiratory-Center Equation and Integration Audit

Status: **primary equations recovered; implementation remains blocked at several inherited/ambiguous parameters**
Date: 2026-10-11
Authority: **candidate/shadow only**

## Primary source

Hennigs C, Bilda F, Selpien H, Lerg T, Männel G, Becher T, Schädler D, Rostalski P.
Patient-ventilator interaction—Development of a mathematical model of the respiratory center.
Comput Methods Programs Biomed. 2026;280:109329.
DOI: 10.1016/j.cmpb.2026.109329. PMID: 41905158.

The full article is open access and defines a respiratory-center model composed of:
- a five-population neural oscillator;
- central and peripheral chemical feedback;
- Hering-Breuer and additional mechanical reflexes;
- inspiratory/expiratory respiratory-muscle pressure;
- a lung-mechanics plant;
- ventilator interaction logic.

For this project, **Vent remains the mechanics owner**. Hennigs is being evaluated as the neural respiratory-drive / patient-effort owner.

## Project boundary

```
blood / brain gases + pH
        +
Vent actual V(t), q_aw(t), P_aw(t)
        |
        v
Hennigs respiratory-center shadow
        |
        v
Pmus(t) / respiratory timing
        |
        v
Vent mechanics
        |
        +--> actual VT / flow / pressure
        +--> gas exchange
        +--> lung-stretch feedback
```

Do not transplant Hennigs Eqs. 18-22 as the canonical lung plant. They are retained as reference semantics only.

---

## 1. Neural oscillator — Eq. 1

Five neural populations:
- R: early inspiratory;
- I: inspiratory;
- L: late inspiratory;
- P: post-inspiratory;
- E: expiratory.

Source structure:

```
dR/dt = -aR R + WIR S(I) + WPR S(P) + WRR S(R) + BR

dI/dt = -aI I + WEI S(E) + WPI S(P)
        + WLI S(L) + WII S(I) + BI

dL/dt = -aL L + WIL S(I) + WEL S(E)
        + WRL S(R) + WLL S(L) + BL

dP/dt = -aP P + WEP S(E) + WRP S(R)
        + WPP S(P) + BP

dE/dt = -aE E + WIE S(I) + WRE S(R)
        + WEE S(E) + BE
```

### Connection-matrix orientation

A Botros/Bruce-lineage reproduction reports the matrix with:
- **row = source population**;
- **column = target population**.

Reported values:

| source \ target | I | L | P | E | R | tonic |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| I | 0.700 | 1.361 | 0 | -0.729 | -1.800 | 5.044 |
| L | -5.000 | 2.300 | 0 | 0 | 0 | -2.200 |
| P | 1.719 | -3.000 | 1.540 | 0 | -2.150 | 3.989 |
| E | 1.371 | -0.793 | -1.351 | 1.550 | 0 | 4.140 |
| R | 0 | -2.056 | -2.254 | -2.254 | 0.650 | 2.193 |

This orientation is now resolved against Hennigs Eq. 1: **rows are source populations and columns are target populations**.

Examples:
- R equation: I->R = row I / col R = -1.8; P->R = row P / col R = -2.2; R->R = +0.7.
- I equation: E->I = -1.4; P->I = -1.7; L->I = -5.0; I->I = +0.7.
- L equation: I->L = +1.4; E->L = -0.8; R->L = -2.1; L->L = +2.3.
- P equation: E->P = -1.4; R->P = -2.3; P->P = +1.5.
- E equation: I->E = -0.7; R->E = -2.3; E->E = +1.6.

This mapping resolves the source/target orientation, but it also exposes one primary-source inconsistency: Table 2 contains P->L = -3.0, while the printed Eq. 1 late-inspiratory equation omits W_PL*S(P). The candidate therefore preserves P->L=-3.0 as provenance data but does not activate it. For the governing dynamics, the printed differential equation has precedence until an author correction or source implementation proves otherwise.

### Inherited sigmoid S(X)

Hennigs cites the Botros/Bruce oscillator for `S[·]` rather than redefining it.

A later implementation explicitly incorporating that oscillator gives:

```
S(X) = K * alpha(X) + (1-K) * beta(X)

alpha(X) =
  0,               X < 0
  min(X,4),        X >= 0

beta(X) = 4 / (1 + exp(-1.75 * (X-2)))
```

A reproduced implementation uses `K = 0.6`.

**Status:** acceptable as inherited-model reproduction evidence for a shadow implementation only. Before canonical use, the exact Botros/Bruce 1990 source form and K value should be directly verified if the primary full text becomes available.

---

## 2. Chemical feedback — Eqs. 2-8

### Central drive — Eq. 2

```
dDC/dt = ( GC * (theta_pHm - pHm) - DC ) / tauC
```

Known:
- GC = 27.72 excitation / delta-pH
- tauC = 100 s
- theta_pHm = 7.32

### Peripheral O2 drive — Eq. 3

```
dDPO2/dt = ( GPO2 * (75 mmHg - PaO2) - DPO2 ) / tauP
```

Known:
- GPO2 = 0.2 excitation/kPa as listed by the paper;
- tauP = 1 s.

The text describes hypoxic activation below approximately 75 mmHg. The implementation must confirm whether the source clips this term to zero above the threshold. Do not allow a negative "hypoxic drive" unless source behavior supports it.

### Peripheral CO2 / arterial-pH drive — Eq. 4

```
dDPCO2/dt =
  ( GPCO2 * PaCO2
    + GPCO2_pH * (theta_pHa - pHa)
    - DPCO2 ) / tauP
```

Known:
- GPCO2 = 0.08 excitation/kPa
- theta_pHa = 7.40
- tauP = 1 s

**Blocker:** the exact `GPCO2_pH` parameter is not yet source-complete in the recovered table text.

### Medullary CO2 / pH — Eq. 5 pathway

The source computes medullary CO2 using blood CO2, CSF CO2, and cerebral blood flow, in the form:

```
PmCO2 =
  PbCO2
  + (PcsfCO2 - PbCO2) * exp(-kcr * sqrt(QB))
```

Recovered:
- kcr approximately 1.139 in the source unit system.

Then medullary pH is calculated with Henderson-Hasselbalch.

**Integration blocker:** the digital twin needs source-valid:
- brain/blood CO2;
- CSF CO2;
- cerebral blood flow;
- acid-base mapping.

Do not substitute arterial PaCO2 for all three compartments silently.

### Total drive — Eqs. 6-8

Printed equation structure gives:

```
Dtotal = DC + DPCO2 + DPO2
Drel   = ach * Dtotal + bch + sigma_Dtotal
```

Recovered parameters:
- ach = 1
- bch = -4
- sigma_Dtotal = 0.65
- Drel is constrained to 0-1.

The prose states that O2 drive is weighted by 0.25 when total chemical drive is formed.

**Blocker:** reconcile the prose 0.25 O2 weight with the printed Eq. 6 representation before coding.

The resulting relative drive scales tonic neural inputs for R/I/P/E. The implementation must keep the original tonic values and the scaled values as separate variables; do not overwrite the baseline constants.

---

## 3. Respiratory-rate scaling — Eqs. 9-10

Recovered Eq. 9 structure:

```
RR = 10 /min + exp(1.8 * Drel) * 2.1 /min
```

The neural coupling is subsequently scaled by `KRR`.

**Blocker:** the extracted Eq. 10 constants/units are ambiguous in the machine-readable full text. Visually verify the source expression before coding `KRR`.

---

## 4. Mechanical feedback — Eqs. 11-15

These inputs must come from **actual Vent state**, not from a second lung model.

### Hering-Breuer — Eq. 11

```
DHB = S( KPRS * ( V(t) - V0 - VHB ) )
```

Recovered:
- KPRS = 7.5 excitation/L
- VHB = 1-1.5 L

Effect:
- inhibit inspiratory tonic drive;
- excite expiratory tonic drive.

### Inspiratory-flow reflex — Eq. 12

```
Dinsp = S( Kinsp * q_aw,insp )
```

Recovered:
- Kinsp = 2 excitation*s/L

Effect:
- inhibits inspiration;
- promotes expiration.

### Negative-pressure reflex — Eqs. 13-14

```
Pua = Rua * q_aw - Pmus
Dneg = S( Kua * Pua )
```

Recovered:
- Kua = 2 excitation/mmHg
- tau_ua = 1 s
- basal Rua = 1 mmHg*s/L

The source states this reflex is patient-triggered, not ventilator-triggered.

**Integration requirement:** reconcile Hennigs' positive-inspiratory `Pmus` convention with Vent's sign convention before coupling.

### Expiratory resistance reflex — Eq. 15

Recovered source extraction:

```
Dexp = S( Kexp * (Rth - Rua) )
```

Recovered:
- Kexp = 0.7 excitation*L/(mmHg*s)
- Rth = 20-50 mmHg*s/L

**Blocker:** the prose says the reflex activates when upper-airway resistance exceeds threshold, which appears sign-inconsistent with the extracted equation if `S` is monotonic increasing. Resolve from the source figure/equation before implementation.

---

## 5. Respiratory muscle pressure — Eqs. 16-17

### Piecewise muscle pressure — Eq. 16

Source convention:

```
if I(t) >= 0 and E(t) < Eexp:
    Pmus = KI * I(t)

else if I(t) < 0 and E(t) >= Eexp:
    Pmus = -KE * ( E(t) - Eexp )

else:
    Pmus = 0
```

Recovered:
- Eexp = 5.2 excitation.

### Muscle gains — Eq. 17

```
Km =
  ( Pmax_m * 0.25 / phi_max_m )
  * (1 - rho_resp)

m in {I,E}
```

Recovered:
- rho_resp in 0-1
- factor 0.25 is explicit
- KI and KE are calculated, not free tuning constants.

**Blocker:** obtain the exact age/sex/BMI `Pmax_I/Pmax_E` source relationship and the Hennigs definition/value of `phi_max` before assigning patient-specific Pmus amplitude.

---

## 6. Hennigs lung mechanics — Eqs. 18-22

**Reference only.**

The paper includes:
- pressure/flow balance;
- upper-airway and volume-dependent resistance;
- nonlinear compliance/elastance;
- alveolar pressure.

These equations are useful for reproducing the paper's validation cases but are not candidates to replace Vent's existing high-resolution lung mechanics without a separate ownership decision.

---

## 7. Ventilator logic — Eqs. 23-27

**Reference/validation only.**

The source contains:
- pressure target;
- inspiratory ramp;
- PI flow control;
- flow trigger;
- cycling criteria.

Use these to reproduce Hennigs pressure-support/asynchrony experiments. Do not overwrite the existing Vent controller merely to mirror the paper.

---

## 8. Source validation protocols

### T1 — chemical challenge

Source examples:
- hypercapnia: inspired CO2 7% for 25 min;
- hypoxia: inspired O2 8% for 10 min.

Compared variables:
- respiratory rate;
- tidal volume;
- time to peak;
- AUC;
- baseline;
- peak.

Nominal acceptance:
- MAPE <= 10%.

Reported paper results include:
- hypoxia RR MAPE 3.86%;
- hypoxia VT MAPE 10.23%;
- hypercapnia RR MAPE 9.72%;
- hypercapnia VT MAPE 11.18%.

Therefore, do **not** state that every T1 metric satisfied the nominal 10% criterion.

### T2 — pressure support

Pressure support:
- 0-25 mbar.

Compared:
- RR;
- VT;
- minute ventilation;
- P0.1 / Pmus-related behavior.

Nominal acceptance:
- MAPE <= 10%.

### T3 — asynchrony

Compared:
- incidence of patient-ventilator asynchrony.

Nominal acceptance:
- absolute incidence difference <= 5 percentage points.

---

## 9. Immediate implementation decision

### Implementable now as isolated helpers
The following can be encoded as non-authoritative pure functions with explicit provenance:
- inherited `S(X)` candidate;
- Eq. 1 oscillator topology and source matrix, after Hennigs Table-2 mapping is reconciled;
- central-drive Eq. 2;
- O2-drive Eq. 3 with fail-closed threshold handling;
- Hering-Breuer Eq. 11;
- inspiratory-flow Eq. 12;
- upper-airway pressure Eq. 13;
- piecewise Pmus Eq. 16;
- generic Eq. 17 gain calculator requiring caller-supplied verified Pmax and phi_max.

### Do not activate yet
Block canonical respiratory drive until all of these are resolved:
1. direct verification of inherited sigmoid/K against Botros/Bruce primary source if obtainable;
2. late-inspiratory tonic-input footnote / Drel-dependent B_L implementation;
3. `GPCO2_pH`;
4. Eq. 6 O2 weighting;
5. Eq. 10 KRR expression;
6. Eq. 15 sign;
7. source-valid brain/CSF CO2 and cerebral-flow inputs;
8. Pmax/phi_max source chain for muscle pressure;
9. deterministic handling of stochastic/noise terms.

## 10. No-double-authority rule

Hennigs and the older Ursino ventilatory-control equations must not both own respiratory neural drive.

Target ownership after validation:
- Hennigs: respiratory neural timing/drive and Pmus;
- Vent: actual lung mechanics, pressure, flow, and VT;
- gas-exchange model: arterial/alveolar gas states;
- Ursino/Magosso: cardiovascular autonomic response to those states unless replaced by a better validated owner.

## Decision

**ADVANCE HENNIGS AS THE PREFERRED RESPIRATORY-DRIVE SHADOW CANDIDATE. DO NOT ACTIVATE.**

The previous statement that a complete primary-source representation was unavailable is obsolete. The remaining blockers are specific and auditable rather than a general lack of source access.
