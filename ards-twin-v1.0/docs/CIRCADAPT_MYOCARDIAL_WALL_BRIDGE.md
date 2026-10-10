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


## Direct dimensional stress mapping

The Shimayoshi contraction module computes active cross-bridge force density in `mN/mm^2`.

Dimensional identity:

```
1 mN/mm^2 = 1 kPa = 0.001 MPa
```

Therefore the cellular active-stress output can be supplied to the CircAdapt wall mechanics without an empirical force-to-Emax gain.

This is the preferred bridge:

```
Shimayoshi active cross-bridge stress [mN/mm^2]
    -> dimensional conversion to MPa
    -> CircAdapt myocardial fiber stress
    -> wall tension
    -> chamber pressure
```

## Interim human reference geometry

The MONARCH/CircAdapt human example provides a source implementation reference configuration:

- LV free-wall midwall reference area: 7920 mm^2
- LV free-wall wall volume: 58200 mm^3
- septal midwall reference area: 4160 mm^2
- septal wall volume: 41896 mm^3

These are reference-model geometry values, **not patient measurements**.

They may be used for a clearly labeled reference-human shadow run but must not be presented as individualized anatomy.

## Browser implementation strategy

The full Shimayoshi cellular model is too detailed to execute directly in the current browser loop without a dedicated port.

The acceptable reduced-order route is:

1. run the original/open source cellular model across a prespecified grid of:
   - extracellular CO2 / acid-base conditions;
   - oxygen availability;
   - pacing/heart-rate conditions;
   - loading conditions where the source model permits;
2. record active cross-bridge stress, intracellular pH, ATP, PCr, Pi and calcium states;
3. fit a reduced-order surrogate to **active stress**, not directly to HR/MAP/CO;
4. document:
   - source model revision;
   - input grid;
   - fitting method;
   - train/validation split;
   - maximum and RMS stress error;
   - monotonicity/physiology checks;
5. feed surrogate active stress through the CircAdapt wall bridge;
6. validate resulting pressure-volume behavior independently.

No surrogate may be tuned against the desired bedside HR/MAP/CO response.
