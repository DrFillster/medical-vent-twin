# Pre-transition phenotype packet

The phenotype packet is the frozen patient state used to initialize the digital twin before an index ventilator intervention.

It is generated locally by:

`research/mimic/build_pretransition_phenotype_packet.py`

Local output:

`/Users/philipbernard/mimic-data/derived/pretransition_phenotype_packet.parquet`

Patient-level output is not committed to GitHub.

## Design rule

Only information available before the index transition can enter the packet.

Historical ventilator perturbations may be used if they occurred before the index transition.

Post-index outcomes are never used to initialize, fit, grade, or select the phenotype.

## Phenotype axes

### Mechanics

Observed inputs:

- compliance
- resistance
- VT
- airway pressures
- PEEP

Grades:

- **A**: compliance and resistance directly available
- **B**: compliance available or enough mechanics observables exist for constrained fitting
- **C**: mechanics remain prior-constrained

### Patient effort

Primary assisted-mode variables:

- neural respiratory drive
- muscle-transmission amplitude

Observed fitting targets:

- total RR
- VT
- minute ventilation
- pressure support
- compliance when available

Grades for PS:

- **A**: RR + VT + MV + PS + compliance available
- **B**: RR + VT + MV + PS available; mechanics prior still required
- **C**: insufficient effort observables

Controlled modes do not receive an effort grade in the current primary pipeline.

### Dead-space / CO2 elimination

Measured descriptor when available:

`(PaCO2 - PETCO2) / PaCO2`

This is retained as a PaCO2-PETCO2 gradient descriptor and is not treated as identical to full Bohr/Enghoff physiologic VD/VT.

Grades:

- **A**: valid EtCO2 pair <=5 min from arterial PaCO2
- **B**: valid pair >5 to <=15 min
- **C**: no direct EtCO2 constraint; dead-space behavior remains latent/prior-constrained

### Oxygenation / recruitment

Baseline evidence:

- PaO2
- SpO2
- FiO2
- PEEP

Historical pre-index PEEP perturbations can additionally constrain:

- fixed nonrecruitable perfusion burden
- recruitable perfusion burden
- current recruitment state
- patient-specific recruitment pressure threshold

Recruitment kinetics remain fixed unless future data show that they are independently identifiable.

Grades:

- **A**: tight controlled-mode historical PEEP response with adequate mechanics
- **B**: tight historical PEEP response requiring assisted-mode effort modeling
- **C**: broad historical context or baseline oxygenation only

A wide historical ABG window may support exploratory context but does not by itself justify a precise recruitment estimate.

### Hemodynamic/autonomic state

Current packet stores baseline HR and MAP.

Response sensitivities and autonomic gains are not yet considered identified from the current packet.

## Fit readiness

`pretransition_fit_ready` means that the minimum mode-specific ventilator settings and pre-transition ABG state are present for numerical fitting.

It does **not** mean every phenotype axis is Grade A or that the event is ready for blinded prediction.

## Current cohort

Supported-mode cohort:

- total: 411
- PS: 333
- PC_AC: 70
- VC_AC: 8

Pre-transition fit-ready:

- 351/411

Current identifiability distribution:

### Mechanics

- A: 159
- B: 16
- C: 236

### PS effort

- A: 112
- B: 161
- C: 60

### Dead-space

- A: 4
- B: 7
- C: 400

### Recruitment

- B: 6
- C: 405

The recruitment distribution reflects the deliberately strict pre-index historical evidence rule. It should not be relaxed simply to increase sample size.
