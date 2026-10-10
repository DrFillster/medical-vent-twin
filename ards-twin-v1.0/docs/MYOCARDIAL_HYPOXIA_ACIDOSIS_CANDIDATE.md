# Myocardial Hypoxia and Acidosis Candidate Model

Date: 2026-10-10
Status: selected candidate architecture; shadow implementation only
Control authority: none

## Decision

The preferred myocardial-depression pathway is **not** a direct arterial PaO2-to-contractility or arterial-pH-to-contractility multiplier.

Selected mechanistic sources:

1. **Crampin & Smith 2006** for intracellular-acidosis effects on ventricular excitation-contraction coupling.
2. **Shimayoshi, Takeuchi & Matsuoka 2026** for integrated O2 transport, mitochondrial energetics, intracellular pH, Ca handling, cross-bridge force, ATP/PCr, ischemia and respiratory-acidosis behavior.

The 2026 source implementation is publicly available at:
`atakeuti/TS-AT-SM-2026-IRmodel`.

## Why this candidate

The source model represents two distinct mechanisms that converge on contraction:

### A. Acidosis

Extracellular CO2 changes intracellular pH through CO2 diffusion, bicarbonate/H+ transport and buffering.

Intracellular pH then modifies multiple excitation-contraction components rather than directly scaling ventricular pressure:

- ryanodine receptor Ca release;
- SERCA;
- Na/Ca exchange;
- troponin-C / cross-bridge kinetics;
- glycolytic ATP production;
- other pH-sensitive membrane transport.

Example source-code pH term for RyR:

```
pHFactor_RyR =
  [1 + 10^(n_rel * (-pHref + pKrel))]
  /
  [1 + 10^(n_rel * (-pHi + pKrel))]
```

with:
- pHref = 7.15
- pKrel = 6.64
- n_rel = 1.87

The cross-bridge module also uses intracellular H+, phosphate, ATPMg and phosphocreatine.

### B. Hypoxia / oxygen-supply failure

Oxygen enters the cell by diffusion:

```
J_O2 = permeability * (O2_external - O2_intracellular)
```

Mitochondrial Complex IV explicitly depends on intracellular O2:

```
V_C4 =
  k_C4 * Cyta_r * Cytc_r *
  O2_i / (O2_i + Km_C4_O2)
```

with `Km_C4_O2 = 0.150 mM` in the 2026 implementation.

The resulting oxidative-phosphorylation state alters:
- mitochondrial ATP production;
- cytosolic ATP/ADP;
- phosphocreatine;
- ATP-sensitive ion channels;
- Ca cycling;
- cross-bridge cycling and force.

This is the preferred causal route for hypoxic myocardial depression.

## Project mapping

Target future chain:

```
coronary flow + arterial O2 content
           |
           v
myocardial O2 delivery / extracellular O2
           |
           v
intracellular O2 -> Complex IV / OXPHOS
           |
           v
ATP / ADP / PCr / Pi
           |
           +-------------------+
           |                   |
           v                   v
Ca handling             cross-bridge energetics
           \                   /
            \                 /
             v               v
                 force
                   |
                   v
        whole-heart elastance adapter
                   |
                   v
               SV / CO / MAP
```

Acidosis enters through extracellular CO2 / acid-base transport -> **intracellular pH**, not arterial pH directly.

## Critical implementation boundary

The cellular model outputs myocyte force/shortening. The Vent/HumMod cardiovascular plant uses ventricular contractility/elastance.

**No source-valid cell-force -> whole-heart Emax mapping has yet been established.**

Therefore:
- cellular pH/O2/energy factors may run in shadow mode;
- whole-heart contractility multiplier remains null;
- do not multiply Emax directly by arterial pH, PaO2, ATP factor, or Complex-IV O2 factor.

## Existing reduced-core behavior

The current oxygen-debt/asphyxial contractility reduction in
`hummod_ards_decompensation_controller.js` remains a legacy engineering bridge for regression continuity.

It is **not the target myocardial-depression model** and should be retired after the mechanistic myocardial pathway is integrated and validated.

## Validation targets

Before whole-heart activation:

1. respiratory acidosis:
   - reproduce the source model's rapid contractile depression;
   - reproduce partial recovery during sustained acidosis;
   - reproduce recovery/overshoot behavior where appropriate;

2. oxygen limitation:
   - preserve early compensatory cardiovascular/autonomic response;
   - myocardial depression should emerge through myocardial O2/energy failure rather than low systemic PaO2 alone;
   - reproduce PCr/ATP decline and contraction failure sequence from the selected source model;

3. combined hypoxic-hypercapnic challenge:
   - allow simultaneous autonomic compensation and myocardial depression;
   - avoid forcing HR and contractility to move in the same direction;

4. whole-organ adapter:
   - validate the force-to-elastance transformation independently before it gets control authority.

## Candidate status

**Suitable candidate selected.**

- Acidosis mechanism: Crampin-Smith / Shimayoshi intracellular-pH E-C coupling.
- Hypoxia mechanism: Shimayoshi intracellular-O2 -> mitochondrial energetics -> ATP/PCr -> contraction.
- Whole-heart Emax mapping: still blocked; requires a separately validated adapter.


## Physician-facing display rule

The cellular mechanism is an internal model layer, not a physician-facing output surface.

Do **not** add routine UI cards for RyR, NCX, Complex IV, ATP, PCr, or intracellular O2 merely because the model computes them.

The clinical evaluation surface remains the existing bedside variables:
- HR
- MAP
- CO
- SV
- SVR
- PVR
- PaO2
- PaCO2
- arterial pH
- SvO2
- arrest/rhythm state

The myocardial candidate should become visible clinically only through its source-valid effect on ventricular contractility and therefore SV, CO, MAP, and downstream oxygen delivery. Mechanistic states may remain available in developer/research diagnostics.
