# Reference-case calibration: moderate Berlin ARDS / intermediate mechanical recruitability

Case: `berlin-moderate-moderate-aspiration`

Status: engineering calibration profile; not clinical validation.

## Purpose

This case is the first end-to-end Vent + HumMod integration reference. It is synthetic and is not intended to represent an archetypal or average ARDS patient.

The case deliberately separates:

1. **Berlin oxygenation severity** — a clinical syndrome/severity axis.
2. **Vent recruitability phenotype** — an authored mechanical construct used to exercise recruitment/derecruitment behavior.

These axes must not be collapsed into one another.

## Cohort-calibrated clinical envelope

The moderate Berlin case inherits its descriptive respiratory-mechanics envelope from CHARDS (Huang X et al., *Critical Care* 2020;24:515; DOI 10.1186/s13054-020-03112-0).

The values in `calibrationTargets` are retained as published medians/IQRs.

They are:

- calibration envelopes;
- not individual-patient targets;
- not instructions for ventilator management;
- not evidence that the Vent mechanical preset reproduces an individual patient.

LUNG SAFE (Bellani G et al., *JAMA* 2016;315:788-800; DOI 10.1001/jama.2016.0291; PMID 26903337) is retained as an external real-world ARDS benchmark rather than a parameter-fitting dataset.

## Recruitability boundary

The case label `moderate` recruitability means **intermediate Vent mechanical construct**.

It does **not** mean:

- R/I ratio = 0.5;
- a specific CT recruitable fraction;
- a specific EIT phenotype;
- a treatment recommendation.

Chen et al. demonstrated wide inter-individual variation in recruitment-to-inflation physiology and emphasized accounting for airway-opening pressure (Am J Respir Crit Care Med. 2020;201:178-187; DOI 10.1164/rccm.201902-0334OC; PMID 31577153).

Therefore `recruitmentToInflationRatioTarget` remains `null` until Vent contains a protocol-faithful R/I measurement implementation that is separately verified.

## Airway-opening pressure boundary

The current mechanical preset uses an airway-opening-pressure parameter. That parameter is a mechanistic scenario property, not a measured patient value.

Airway closure/AOP can occur in mechanically ventilated ARDS and may materially alter interpretation of recruitment maneuvers. See Guerin C et al., *J Appl Physiol* 2020;128:1594-1603; DOI 10.1152/japplphysiol.00059.2020; PMID 32352339.

The browser therefore labels the preset AOP as a **model construct**.

## Required before claiming a clinically realistic reference twin

The reference case should not be described as clinically validated until all of the following are complete:

- explicit ventilator settings and recruitment initialization;
- passive mechanics obtained from modeled zero-flow holds;
- a real, non-fixture HumMod trajectory from the pinned runtime;
- reproducible HumMod raw-output parsing and provenance;
- comparison of simulated mechanics with the authored cohort envelope;
- separate recruitability measurement if an R/I value/classification is displayed;
- review of the full trajectory, not only one static state.

## Prohibited shortcuts

Do not:

- infer recruitability from Berlin severity;
- assign R/I from the preset label;
- treat oxygenation response alone as proof of recruitment;
- treat preset AOP as a bedside measurement;
- label browser fixture HumMod data as physiologic validation;
- present cohort medians as a synthetic patient's observed values.
