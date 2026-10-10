# Oxygen Delivery, Extraction, and Tissue Dysoxia Evidence Roadmap

Status: evidence hierarchy and implementation policy
Date: 2026-10-10
Applies to: v1.5 and later

## Governing principle

Global oxygen delivery is necessary but not sufficient to represent tissue oxygenation in shock.

The model must preserve the chain:

```
CO x CaO2
  -> global DO2
  -> regional blood-flow allocation
  -> organ delivery
  -> extraction reserve
  -> tissue oxygen state / VO2
  -> oxygen-supply deficit when demand cannot be met
```

Disease states may additionally impair microvascular distribution, diffusion, extraction, or cellular oxygen utilization even when global DO2 appears adequate.

No single Cain-derived DO2crit is a universal patient threshold.

## Evidence hierarchy

### Tier 1 — foundational physiology: Cain / Schumacker

1. Cain SM. Oxygen delivery and uptake in dogs during anemic and hypoxic hypoxia. J Appl Physiol. 1977;42:228-234. DOI: 10.1152/jappl.1977.42.2.228. PMID: 14097.
   - Establishes the supply-independent / supply-dependent concept in controlled animal hypoxia/anemia.
   - Reported an experimental critical total oxygen delivery of 9.8 mL/kg/min in that canine preparation.
   - Project use: physiologic concept and validation shape only.
   - Project restriction: the reported numerical threshold is NOT a universal human threshold and must not be hard-coded as such.

2. Schumacker PT, Cain SM. The concept of a critical oxygen delivery. Intensive Care Med. 1987;13:223-229. PMID: 3301969.
   - Formalizes the concept that falling DO2 is initially compensated by increasing extraction, followed by supply-dependent VO2 once extraction reserve is exhausted.
   - Notes impaired extraction in ARDS/sepsis as a distinct problem.

3. Nelson DP, King CE, Dodd SL, Schumacker PT, Cain SM. Systemic and intestinal limits of O2 extraction in the dog. J Appl Physiol. 1987;63:387-394. DOI: 10.1152/jappl.1987.63.1.387.
   - Demonstrates that regional supply dependence can occur before whole-body critical delivery.
   - Project implication: organ redistribution and organ-specific extraction cannot be replaced by one global threshold.

4. Nelson DP, Beyer C, Samsel RW, Wood LD, Schumacker PT. Pathological supply dependence of O2 uptake during bacteremia in dogs. J Appl Physiol. 1987;63:1487-1492. DOI: 10.1152/jappl.1987.63.4.1487.
   - Supports disease-dependent impairment of extraction reserve.

### Tier 2 — integrated mathematical cardiopulmonary modeling

5. Albanese A, Cheng L, Ursino M, Chbat NW. An integrated mathematical model of the human cardiopulmonary system: model development. Am J Physiol Heart Circ Physiol. 2016;310:H899-H921. DOI: 10.1152/ajpheart.00230.2014. PMID: 26683899.

6. Cheng L, Albanese A, Ursino M, Chbat NW. An integrated mathematical model of the human cardiopulmonary system: model validation under hypercapnia and hypoxia. Am J Physiol Heart Circ Physiol. 2016;310:H922-H937. DOI: 10.1152/ajpheart.00923.2014. PMID: 26747507.
   - Project use: integrated control architecture and hypoxia/hypercapnia validation framework.

### Tier 3 — modern shock / microcirculation qualification

7. Ince C. Microcirculation: physiology, pathophysiology, and clinical application. Blood Purif. 2020;49:143-150. PMID: 31851980.
   - Loss of hemodynamic coherence can permit tissue hypoxia despite apparently corrected systemic hemodynamics.

8. Kanoore Edul VS et al. Sepsis and the microcirculation: the impact on outcomes. Curr Opin Anaesthesiol. 2022. PMID: 35081058.
   - Sepsis can produce persistent tissue hypoxia through microcirculatory dysfunction despite adequate macrocirculatory variables.

9. Current critical-care reviews of circulatory shock emphasize individualized global oxygen-delivery components together with tissue perfusion and avoidance of assuming that normalized macrocirculation guarantees adequate tissue oxygenation.

## Current project interpretation

### Source-backed and retained
- global DO2 from flow x arterial O2 content;
- organ DO2 from organ blood flow x arterial O2 content;
- oxygen extraction ratio;
- venous O2 return;
- unmet aerobic O2 demand integrated as oxygen debt;
- disease/context-dependent extraction reserve where an explicit source exists.

### Context-specific reduced-order relation
`hummod_ards_oxygen_supply_cliff.js` uses Ward's canine hypercapnia data to modify extraction reserve under severe hypercapnia. This is a context-specific experimental relation, not a general critical-DO2 law.

### Engineering boundary requiring stronger provenance
`CRITICAL_VENOUS_PO2_MMHG = 15` in the reduced gas core currently acts as a numerical/physiologic extraction floor.

Until a source is selected and transcribed:
- retain behavior for backward compatibility;
- classify it as an explicit engineering boundary;
- do not describe it as a universal physiologic threshold;
- do not use it for patient-facing clinical classification.

## Disease-layer architecture

A future microcirculatory/dysoxia layer may modify:
- effective perfused capillary fraction;
- heterogeneity/shunting;
- effective extraction capacity;
- diffusion distance;
- cellular utilization efficiency.

It must NOT modify global DO2 by an arbitrary gain. It acts downstream of global and regional oxygen delivery.

Potential disease-specific inputs:
- sepsis/inflammatory state;
- edema/capillary leak;
- severe shock state;
- organ-specific perfusion state.

## Validation plan

1. preserve global oxygen mass balance;
2. preserve organ flow allocation;
3. test anemia, hypoxemia, low cardiac output, and mixed insults separately;
4. confirm rising extraction before supply-dependent VO2 in normal physiology;
5. confirm disease layers can impair extraction without requiring a fall in global DO2;
6. compare organ-specific failure timing rather than only whole-body thresholds;
7. never calibrate a universal human DO2crit from Cain's canine threshold.
