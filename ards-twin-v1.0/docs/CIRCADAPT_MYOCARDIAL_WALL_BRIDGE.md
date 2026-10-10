# Whole-heart bridge candidate: CircAdapt/TriSeg wall mechanics

Date: 2026-10-10
Status: selected bridge architecture; shadow only

## Decision

The preferred bridge from the myocardial hypoxia/acidosis cell model to whole-heart hemodynamics is **not** a direct cellular-force -> Emax multiplier.

Use CircAdapt/TriSeg-style wall mechanics:

```
myocardial fiber stress
        ↓
wall tension
        ↓
chamber pressure from wall geometry
        ↓
valves + vascular load + chamber volumes
        ↓
SV / CO / MAP
```

This creates a mechanistic path from cellular contractile impairment to bedside hemodynamics while preserving preload, afterload, wall geometry and ventricular interaction.

## Core equations

The open MONARCH implementation of CircAdapt/TriSeg uses:

```
Tm = sigma_f * Vw / (2 * Am)
```

where:
- `sigma_f` = myocardial fiber stress;
- `Vw` = wall volume;
- `Am` = midwall area.

Ventricular pressure is then:

```
P = 2 * Tm / |Rm| * 7.5e3
```

where `Rm` is midwall radius and the numerical factor converts the implementation's stress/geometry units to mmHg.

The TriSeg formulation additionally solves LV free wall, RV free wall and septal geometry simultaneously.

## Mapping from the selected myocardial model

Shimayoshi/Takeuchi/Matsuoka produces cell-level active force/stress through cross-bridge mechanics that are sensitive to:
- intracellular pH;
- Ca handling;
- ATP/ADP;
- phosphocreatine;
- phosphate;
- intracellular O2 / mitochondrial energetics.

That output is conceptually compatible with CircAdapt's required myocardial active fiber stress.

## Important remaining inputs

The bridge cannot yet generate a patient ventricular pressure because the current Vent/HumMod product does not have source-valid values for:
- LV/RV myocardial wall volume or mass;
- reference midwall area;
- midwall radius / chamber geometry;
- septal geometry if TriSeg is used;
- reference sarcomere stretch mapping.

These must not be silently invented.

## Implementation strategy

### Stage 1
Use a single LV one-fiber wall bridge in shadow mode with explicit geometry inputs.

### Stage 2
Add RV and septum using TriSeg geometry.

### Stage 3
Couple the chamber-pressure solution to the parallel cardiovascular plant.

### Stage 4
Validate against:
- normal pressure-volume loops;
- preload perturbation;
- afterload perturbation;
- isolated contractility reduction;
- hypoxic/acidotic myocardial depression.

## Physician-facing outcome

No new cellular diagnostic cards are required.

Once this pathway is source-complete, its effect appears through:
- SV;
- CO;
- MAP;
- arterial pressure trajectory;
- downstream DO2;
- eventual PEA/circulatory collapse if mechanical output becomes inadequate.

HumMod remains a comparator, not the target.
