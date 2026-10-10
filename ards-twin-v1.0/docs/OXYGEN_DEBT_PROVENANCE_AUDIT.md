# Oxygen Debt and Decompensation Provenance Audit

Date: 2026-10-10
Branch: `v1.5`

## Definition retained

The reduced browser model defines oxygen debt as:

```
oxygen debt = integral of modeled unmet aerobic oxygen demand over time
```

This is a bookkeeping state expressed in mL O2. It is not itself a validated mortality score.

## What is source-backed

- Convective oxygen delivery depends on blood flow/cardiac output and arterial oxygen content.
- Oxygen extraction can compensate for falling delivery until extraction reserve is exhausted.
- Below that point, VO2 becomes supply dependent.
- Regional organs can reach supply limitation at different points.
- Sepsis and other critical illness can dissociate global/macrocirculatory oxygen delivery from tissue oxygenation.

Foundational sources include Cain 1977 and Schumacker/Cain 1987. Human critical-illness evidence includes Ronco et al. 1993. Modern microcirculatory work supports distinct regional/distribution/extraction states.

## What remains an engineering bridge

The current reduced decompensation controller uses accumulated modeled oxygen deficit plus published shock/collapse landmarks to generate a bounded progressive failure state.

The following are **not universal physiologic constants**:

- the 35-minute equivalent-debt normalization;
- the 45% mixed-venous saturation warning marker;
- the 15-mmHg venous PO2 extraction floor;
- the asphyxial interpolation between published timing landmarks.

These values may be useful for deterministic scenario behavior but must not be presented as universal patient thresholds.

## Required future replacement path

A higher-fidelity decompensation model should derive organ injury from:

1. global convective DO2;
2. organ blood-flow allocation;
3. regional oxygen content and extraction;
4. microvascular distribution;
5. cellular utilization;
6. time-integrated regional oxygen deficit;
7. disease-specific injury/recovery equations.

The Yamanaka sepsis layer may modify flow, permeability, cardiac performance, and later microcirculatory/extraction states, but it must not reuse the current engineering collapse bridge as if it were a source sepsis equation.

## Activation policy

No new mortality/collapse threshold may be added solely to obtain a desired time-to-death or arrest phenotype.
