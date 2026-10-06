# Model Provenance Audit

Status: normative project critique for v1.0 and successor work.

## Executive finding

The deployed browser simulator is a hybrid model. It does not execute full native HumMod.

It combines:
1. a custom Vent lung/ventilator mechanics engine;
2. a reduced JavaScript cardiopulmonary core containing equations and constants translated from pinned HumMod source;
3. custom coupling rules between Vent and the reduced systemic model;
4. custom autonomic, oxygen-delivery, decompensation, and arrest logic, some anchored to published experimental literature;
5. synthetic ARDS cases and mechanical phenotypes with published cohort envelopes used as calibration/reference metadata;
6. a separate native HumMod research/calibration path that is not a production dependency.

The production label "reduced source-aligned HumMod core" is defensible. "HumMod systemic physiology engine" is not sufficiently precise for the browser product.

## Provenance classes

Every model element must be assigned one of:
- HUMMOD_EXACT: equation/constant directly preserved from a pinned HumMod source revision.
- HUMMOD_ADAPTED: HumMod-origin relation changed for browser execution, coupling, interpolation, topology, or numerics.
- LITERATURE_DIRECT: published value/threshold/relation used without project fitting.
- LITERATURE_CALIBRATED: project function fitted/interpolated/bounded to published anchors.
- ENGINEERING_ASSUMPTION: locally authored value, topology, transfer function, rule, or condition.
- SCENARIO_AUTHORED: teaching-case value/narrative not asserted as population truth.
- MEASURED_OR_USER_SUPPLIED: runtime input or maneuver-derived quantity.
- DERIVED: deterministic quantity computed from other provenance-tagged values.
- UNKNOWN: temporarily permitted only during migration; release gate must drive this count to zero for the live clinical path.

## Current model classification

### Vent mechanics
Custom three-compartment lung, nonlinear finite-capacity elastic law, airway-opening behavior, compartment resistances, recruitment/derecruitment kinetics, recruitment feasibility projection, and ventilator controllers are project-created mechanistic models. They are not HumMod.

### ARDS mechanical phenotypes
Compartment fractions, regional perfusion/dead-space fractions, elastic scales, airway-opening pressures, and opening/closing pressure anchors are synthetic engineering assumptions. Berlin severity must remain independent of recruitability.

### Berlin and cohort metadata
Berlin criteria are literature-direct. CHARDS respiratory-mechanics distributions are literature-direct cohort descriptors. LUNG SAFE is an external benchmark. These values do not make an individual synthetic case patient-derived.

### HumMod-derived blood-gas core
Strong source alignment exists for:
- bronchial humidification;
- BTPS/STPD conversion;
- HumMod legacy dead-space relation;
- acid-base pH/SID/PCO2 relations;
- bicarbonate/PCO2 conversion;
- hemoglobin P50 and saturation relations;
- O2/CO2 pulmonary exchange algebra;
- first-order blood-gas delays where preserved from HumMod;
- selected source initial states.

### HumMod-derived hemodynamic primitives
Strong source alignment exists for:
- systemic/pulmonary vascular pressure-volume primitives;
- selected V0, compliance, conductance, and initial-volume constants;
- right- and left-ventricular diastolic/systolic pressure-volume equations;
- stroke-volume/cardiac-output algebra;
- basic right-to-left shunt.

### Reduced circulation
The browser circulation is not full HumMod. Organ circulations are lumped into effective conductance boundaries; integration and network topology are project choices. Terminal clamping of negative forward flow to zero and conversion to mechanical-pump-failure/PEA is project logic.

### Thorax bridge
The passive elastance partition is physiologically motivated, but current reference pleural pressure, chest-wall elastance fraction, and related boundaries are engineering assumptions.

### Autonomic controller
The browser autonomic controller is custom. Published hypercapnic-acidosis and myocardial-depression data are calibration anchors, but gains, time constants, reflex transfer functions, venoconstriction rules, and most coefficients are project-authored.

### Oxygen-supply/decompensation/arrest
The oxygen-delivery cliff and shock/arrest model are not HumMod. They are literature-anchored reduced-order engineering models. They must never be presented as validated human mortality prediction.

### Native HumMod path
Native .SOLN parsing, verified source symbols, native sweeps, and native-to-reduced comparison are legitimate HumMod research infrastructure. Native HumMod is not the static production runtime.

## Highest-priority scientific weaknesses

1. ARDS mechanics phenotype parameters are synthetic rather than dataset-derived.
2. Autonomic control is custom rather than source-preserved HumMod.
3. The reduced circulation removes distributed organ flow and much neurohumoral physiology.
4. PEEP-to-pleural/hemodynamic coupling is simplified.
5. Shock/death behavior is educational/research logic, not validated prediction.
6. The nine cases are deterministic authored combinations rather than sampled/fitted patient distributions.
7. Native calibration and native execution must remain explicitly distinct in UI, code, and manuscripts.

## Required project rule

No physiologically meaningful value, equation, condition, transition, threshold, interpolation, topology choice, or default may exist in the clinical live path without machine-readable provenance.

The UI and exported session record must be able to answer: "Where did this number/condition come from?"