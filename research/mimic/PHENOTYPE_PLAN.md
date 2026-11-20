# Pre-change physiological profiles: development specification v1

## Purpose

Add a source-traceable, multidimensional profile layer before expanding model
tests. Profiles describe the transition-time state, not a fixed diagnosis.
This is a proposed research data schema, not a validated clinical classifier.
Do not derive disease labels from fitted twin parameters or prediction errors.

## Initial data dictionary

Oxygenation/support: PaO2, FiO2, PEEP, saturation if available.
CO2/ventilation: PaCO2, minute volume, tidal volume, total respiratory rate.
Acid-base: pH, with bicarbonate/lactate/context to be extracted separately.
Assistance: ventilator mode and pressure support; measured effort is separate.
Mechanics/context: explicit placeholders for plateau/total PEEP, compliance,
resistance, dyssynchrony, diagnosis, sedation/paralysis and capnography.

Preserve raw continuous values. Each feature needs source, pre-index timestamp,
quality and missingness status. Present-in-prefit is NOT independently verified
measurement quality or confirmed time alignment. Missing is not normal. A field
not extracted from current artifacts is not proof it is absent in MIMIC.
No numerical clinical scores, derived dead-space quantities or categorical
severity labels are calculated in this availability pass.

## Completed availability inventory

All 19 development cases retained, stratified by ten qualified/nine failed.
PaO2/FiO2/PEEP/PaCO2/pH/PS/mode present in all 19 prefits. Minute volume 18,
tidal volume 18, total respiratory rate 15. Quality and exact measurement-time
checks remain pending. Mechanics/effort/diagnosis/sedation/lactate/bicarbonate/
capnography fields are not extracted into this profile artifact yet.

`build_phenotype_availability.py` creates source-traceable rows and an aggregate
inventory under derived/dev-phenotype-v1 outside GitHub. No fitted latent values
are used as profile evidence. The output does not assign disease phenotypes.

## Next bounded step

Inspect source measurement timestamps and pre-index extraction windows; expand
raw pre-change feature extraction to supported context fields, retaining
unknowns. Test missingness and provenance on synthetic fixtures. Then compare
profile coverage of qualified versus failed cases without using post-change
outcomes to form labels. Freeze any profile-informed parameter constraints in
development before independent predictive evaluation. Patient-disjoint cohort
construction and prior-use auditing remain required. Production unchanged.
