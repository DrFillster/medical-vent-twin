# Primary myocardial-to-LV bridge: Kato/Utaki/Shim lineage

Date: 2026-10-10
Status: primary LV bridge candidate; source-complete geometry, passive stress, and LV pressure mapping

## Why this supersedes CircAdapt as the primary bridge

The project myocardial model is from the Shimayoshi/Matsuoka cardiac-cell lineage. A direct cell-to-circulation bridge already exists in that same modelling lineage.

Kato, Himeno & Amano (2024) use a detailed myocyte contraction model coupled to an LV geometry/circulation model and explicitly relate cellular contraction force to LV pressure. This framework derives from earlier Utaki and Shim/Amano work.

The primary LV adapter is therefore:

```
Shimayoshi cellular active stress Fb
       ↓
Kato/Utaki cellular-force scaling
       ↓
LV wall stress
       ↓
measurement-based LV geometry
       ↓
Laplace LV pressure
       ↓
circulation
       ↓
SV / CO / MAP
```

CircAdapt/TriSeg remains a useful independent comparison/validation architecture, not the default adapter.

## Published equations and parameters

### LV volume -> radius

```
R_lv = K_R * V_lv + K_V
```

- K_R = 0.012 cm/mL
- K_V = 1.03 cm

### LV radius -> half-sarcomere length

```
L = K_L * R_lv + L_b
```

- K_L = 0.163 um/cm
- L_b = 0.682 um

### Cellular active stress -> wall stress

```
F_ext = K_S * F_b + F_p
```

with:

- K_S = 7.24

The paper explicitly states that K_S was determined using the Utaki method rather than selected to match the present simulator.

### Wall stress -> LV pressure

```
P_lv = 2 * K_u * F_ext * h_lv / R_lv
```

- K_u = 7.50064 mmHg/(mN/mm2)
- h_lv = 1.35 cm in the simplified 2024 formulation.

The 2024 paper reports the geometry/scaling parameters directly in Table 3 and states that instantaneous elastance is directly related to cellular contraction force.

## Passive force — Eq. 23

Primary Kato 2024 transcription:

```
Fp = -K_PL * (1 - L/L0),                         L < L0

Fp = K_PE * (exp[D*(L/L0 - 1)] - 1),            L >= L0
```

Parameters:
- K_PE = 0.2692 mN/mm^2
- K_PL = 7.561 mN/mm^2
- D = 28.08
- L0 = 1.043 um

The paper explicitly states these parameters were manually adjusted to reproduce physiological human hemodynamics. They are published model parameters, not individualized measurements.

The complete bridge now computes:

```
R_lv = K_R * V_lv + K_V
L    = K_L * R_lv + L_b
Fp   = passive(L)
Fext = K_S * Fb + Fp
P_lv = 2 * K_u * Fext * h_lv / R_lv
```

No empirical whole-heart contractility multiplier is introduced and no parameter is fitted to desired MAP/CO/SV.

## Important model implication

At fixed LV geometry, the ratio of active LV pressure contributions equals the ratio of cellular active stress:

```
P_active / P_active,reference
=
F_b / F_b,reference
```

Thus a source-derived Shimayoshi stress trajectory can propagate into LV systolic mechanics without inventing an additional gain.

## Sources

- Kato S, Himeno Y, Amano A. PLoS Comput Biol. 2024;20:e1011974. DOI 10.1371/journal.pcbi.1011974.
- Shim EB, Amano A, Takahata T, Shimayoshi T, Noma A. J Physiol Sci. 2007;57:275-285. DOI 10.2170/physiolsci.RP006007.
- Shimayoshi T, Takeuchi A, Matsuoka S. J Physiol. 2026;604:7640-7662. DOI 10.1113/JP290440.
