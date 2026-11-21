# Metabolic boundary unit audit - 2026-11-21

Scope: dimensional reading of the current implementation, not a new human
metabolic reference range or patient-specific measurement.

## Code path

- clinical_twin_live_hummod_session.js reference gas.systemic explicitly sets
  tissue O2 use to 250 mL/min and CO2 production to 200 * 0.0446, exposed as
  tissueCo2ProductionMmolPerMin. These are fixed model defaults.
- hummod_ards_core_gas_exchange.js defines CO2_LITERS_TO_MOLS = 0.0446 and
  CO2_MOLS_TO_LITERS = 22.4. It uses concentration difference (mol/L, numerically
  identical to mmol/mL) times flow (mL/min) then the latter coefficient to
  express expired volume in mL/min. Constants are rounded, not exact inverses.
- hummod_ards_core_runtime.js converts expired mL/min using 0.0446 to a value
  labeled mmol/min. Dividing by cardiac output mL/min yields mmol/mL, numerically
  identical to the stored mol/L concentration. Production enters the paired
  venous target with the same unit convention.

The constant name is potentially confusing when used on mL rather than L,
but the numerator/denominator scaling is dimensionally consistent in this path.
This review does NOT identify a thousand-fold error to repair. Do not change
production or concentration scale solely because the constant name says L.
Rounding error is not quantified here and clinical gas-standard convention is
not newly validated. Other model paths are outside this unit audit.

## What this does and does not support

Reference values are not patient measurements or proof of appropriate demand
in any selected case. No patient-specific metabolic range or fitting freedom
introduced. Future metabolic fitting requires explicit evidence, population
constraints, and data review; it is confounded with dead-space/alveolar ventilation.
This source audit does not establish that changing metabolism will resolve the
observed pH/CO2 mismatch. No production code or equations changed.
