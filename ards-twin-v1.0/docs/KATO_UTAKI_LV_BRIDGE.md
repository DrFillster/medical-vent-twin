# Primary myocardial-to-LV bridge: Kato/Utaki/Shim lineage

Date: 2026-10-10
Status: primary LV bridge candidate; active component implemented, total pressure fail-closed

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

## Current implementation boundary

The exact active component is implemented:

```
F_active = K_S * F_b

P_active =
  2 * K_u * F_active * h_lv / R_lv
```

Total LV pressure remains null because passive force `F_p` from Eq. 23 has not yet been fully transcribed with its parameter table.

This is deliberate:
- no invented passive pressure;
- no empirical whole-heart contractility multiplier;
- no fitting to desired MAP/CO/SV.

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
