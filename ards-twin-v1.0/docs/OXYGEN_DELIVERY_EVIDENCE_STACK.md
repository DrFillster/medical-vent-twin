# Oxygen Delivery, Extraction, and Tissue Oxygenation Evidence Stack

Status: v1.5 evidence hierarchy
Date: 2026-10-10

## Governing rule

No single whole-body `DO2crit`, venous PO2, mixed venous saturation, extraction ratio, lactate value, or oxygen-debt threshold is treated as a universal human physiologic switch unless a primary source establishes that relationship for the modeled population and state.

The project separates:

1. convective oxygen delivery;
2. tissue extraction reserve;
3. regional blood-flow allocation;
4. microcirculatory flow/distribution;
5. cellular oxygen utilization;
6. accumulated unmet aerobic demand.

## Tier 1 — foundational DO2/VO2 physiology

### Cain 1977

Cain SM. Oxygen delivery and uptake in dogs during anemic and hypoxic hypoxia. J Appl Physiol Respir Environ Exerc Physiol. 1977;42(2):228-234. PMID: 14097.

Role in project:
- foundational demonstration that whole-body oxygen uptake becomes delivery-dependent after extraction reserve is exhausted;
- historical basis for the biphasic DO2-VO2 relationship;
- demonstrates that the relationship depends on the mechanism of hypoxia.

**Not used as a universal numerical human threshold.**

### Schumacker & Cain 1987

Schumacker PT, Cain SM. The concept of a critical oxygen delivery. Intensive Care Med. 1987;13(4):223-229. PMID: 3301969.

Role:
- conceptual definition of critical oxygen delivery;
- explicit recognition that impaired extraction can cause apparent/pathologic supply dependency in ARDS and septic states.

### Nelson et al. 1987 — regional heterogeneity

Nelson DP, King CE, Dodd SL, Schumacker PT, Cain SM. Systemic and intestinal limits of O2 extraction in the dog. J Appl Physiol. 1987;63(1):387-394. PMID: 3114223.

Role:
- regional oxygen extraction and critical delivery differ by organ;
- intestinal/gut supply dependence can occur before whole-body failure.

This directly supports organ-specific oxygen accounting rather than a single global threshold.

## Tier 2 — human critical-illness physiology

### Ronco et al. 1993

Ronco JJ, Fenwick JC, Tweeddale MG, et al. Identification of the critical oxygen delivery for anaerobic metabolism in critically ill septic and nonseptic humans. JAMA. 1993;270(14):1724-1730. PMID: 8411504.

Role:
- human evidence that individual DO2-VO2 behavior is biphasic;
- demonstrates substantial variability and argues against extrapolating older pooled or animal critical-delivery values directly into patients;
- supports retaining extraction and supply-dependence states while avoiding a universal fixed DO2crit.

### Manthous et al. 1994

Manthous CA, Schumacker PT, Pohlman A, Schmidt GA, Hall JB, Samsel RW, Wood LD. Absence of supply dependence of oxygen consumption in patients with septic shock. PMID: 8305957.

Role:
- important counterweight to claims that septic shock universally produces whole-body pathologic supply dependence;
- reinforces disease-state heterogeneity and the need for regional/microcirculatory modeling.

## Tier 3 — integrated mathematical cardiopulmonary modeling

### Albanese / Cheng / Ursino / Chbat 2016

Albanese A, Cheng L, Ursino M, Chbat NW. An integrated mathematical model of the human cardiopulmonary system: model development. Am J Physiol Heart Circ Physiol. 2016. PMID: 26683899.

Cheng L, Albanese A, Ursino M, Chbat NW. An integrated mathematical model of the human cardiopulmonary system: model validation under hypercapnia and hypoxia. Am J Physiol Heart Circ Physiol. 2016;310:H922-H937. PMID: 26747507. DOI: 10.1152/ajpheart.00923.2014.

Role:
- modern integrated-model anchor for cardiopulmonary coupling under hypoxia/hypercapnia;
- validation reference for interaction among ventilation, gas exchange, circulation, and oxygen transport;
- complements, rather than replaces, HumMod whole-body organ accounting.

## Tier 4 — microcirculatory and extraction dysfunction

### Roy & Secomb 2021

Roy TK, Secomb TW. Effects of impaired microvascular flow regulation on metabolism-perfusion matching and organ function. Microcirculation. 2021;28(3):e12673. PMID: 33236393. DOI: 10.1111/micc.12673.

Role:
- establishes that tissue hypoxia can occur despite near-normal systemic cardiac output and arterial oxygen saturation;
- supports a distinct microvascular distribution/extraction layer rather than treating global DO2 as sufficient.

### Munoz et al. 2020

Munoz CJ, Lucas A, Williams AT, Cabrales P. A Review on Microvascular Hemodynamics: The Control of Blood Flow Distribution and Tissue Oxygenation. Crit Care Clin. 2020;36(2):293-305. PMID: 32172814. DOI: 10.1016/j.ccc.2019.12.011.

Role:
- contemporary review of microvascular regulation and oxygen release;
- supports explicit separation of macrovascular delivery from tissue-level oxygen availability.

### Sepsis microcirculation literature

Sepsis is associated with reduced functional capillary density, stopped-flow vessels, heterogeneous perfusion, and impaired extraction; normalization of macrocirculatory values may not normalize tissue perfusion.

Project consequence:
- sepsis layer must be capable of impairing regional/microcirculatory oxygen availability independently of whole-body DO2;
- no generic scalar “sepsis DO2 threshold” will be added.

## Model architecture

```
Cardiac output × arterial O2 content
              |
              v
       GLOBAL CONVECTIVE DO2
              |
              v
     organ blood-flow allocation
              |
              v
      REGIONAL CONVECTIVE DO2
              |
              v
 microcirculatory distribution
              |
              v
      extraction / diffusion
              |
              v
      cellular O2 availability
              |
              v
             VO2
              |
       unmet aerobic demand
              |
              v
          oxygen debt
```

## Implementation decisions

### Retain

- `DO2 = flow × CaO2`;
- organ-specific blood-flow and oxygen-delivery accounting;
- tissue oxygen use/extraction states;
- integrated oxygen supply deficit;
- accumulated oxygen debt as the integral of unmet aerobic demand.

### Do not encode as universal physiologic constants

- Cain experimental DO2crit;
- a single whole-body critical extraction ratio;
- one mixed-venous saturation threshold for all shock states;
- one venous PO2 threshold as a universal transition;
- a sepsis-specific global DO2 threshold.

### Disease layers

Sepsis and other distributive states may modify:
- organ flow allocation;
- functional capillary perfusion;
- extraction efficacy;
- mitochondrial/cellular utilization.

Those modifiers require their own published quantitative provenance.

## Current provenance correction

The reduced gas core currently uses `CRITICAL_VENOUS_PO2_MMHG = 15` as an extraction-boundary implementation detail. A primary source establishing 15 mmHg as a universal physiologic cutoff for this model has not been documented.

Therefore in v1.5:
- the numerical behavior is not silently changed;
- the value is reclassified as an **explicit provisional engineering boundary**;
- it cannot be cited as Cain/Schumacker physiology;
- replacement requires an equation/source audit or migration to organ/microcirculation-specific extraction logic.
