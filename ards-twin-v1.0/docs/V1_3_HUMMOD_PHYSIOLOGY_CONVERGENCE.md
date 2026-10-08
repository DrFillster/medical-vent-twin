# v1.3 HumMod Physiology Convergence Strategy

## Primary objective

The primary physiology objective is to incorporate as much of native HumMod physiology as technically feasible, ideally all model-relevant HumMod physiology.

The reduced/browser model is not the physiological authority. Native HumMod is the reference implementation for model fidelity. External experimental and clinical evidence is the reference for physiologic validity.

This creates three separate comparison questions:

1. **Port fidelity:** Does the browser/reduced implementation reproduce native HumMod?
2. **HumMod validity:** Does native HumMod reproduce observed physiology?
3. **Simulator integration:** Does the Vent + HumMod coupled system preserve clinically coherent cardiopulmonary interactions?

These questions must not be conflated.

## Validation hierarchy

Every probe should report three columns whenever possible:

| Layer | Question |
|---|---|
| Native HumMod | What does HumMod itself predict? |
| Browser/reduced HumMod | Does our implementation reproduce native HumMod? |
| External reality | Is the native/reduced response physiologically plausible according to experimental or clinical evidence? |

A disagreement between HumMod and reality is **not** permission to silently modify HumMod equations. It should be documented as a HumMod limitation or handled through an explicitly labeled model extension.

A disagreement between the browser and native HumMod is a port defect until proven otherwise.

## Architecture direction

### Near term: native HumMod as authority

Use HumMod.EXE under Wine to generate native trajectories for controlled perturbations and clinical-state probes.

Native trajectories should supply internal state automatically. Human users must never enter autonomic, endocrine, metabolic, or other hidden physiologic variables manually.

The browser simulator should consume clinically meaningful user inputs only:
- ventilator settings and maneuvers
- patient/scenario selections
- treatments or interventions intentionally exposed to the learner

### Medium term: expand source-aligned physiology

Replace engineering bridges with exact HumMod pathways subsystem-by-subsystem.

Priority for acute critical-care relevance:

1. autonomic nervous system
2. brain flow, fuel, function, and failure
3. skeletal-muscle flow/metabolism/lactate/metaboreflex
4. left/right heart function and ventricular pumping
5. catecholamines and receptor pools
6. systemic and regional vascular control
7. acid-base, CO2, O2, lactate, electrolytes
8. renin-angiotensin, ADH, aldosterone, ANP
9. renal/nephron physiology and volume regulation
10. tissue metabolism and substrate pools
11. heat/temperature effects
12. remaining organ/tissue systems relevant to the scenario

### Long term: execute HumMod DES semantics

The pinned standalone repository includes the HumMod DES model and executable but not solver source.

If complete physiology is required in-browser or cross-platform without Wine, the scalable solution is a HumMod DES-compatible execution engine or transpiler rather than continued manual equation porting.

Existing `hummod_des_inventory.js` is Phase 0 of that work. It inventories DES constructs but does not execute them.

A future DES runtime must support at minimum:
- variables, parameters, constants
- definitions and ordered blocks
- curves/Hermite interpolation
- conditionals/testcases
- copy/call semantics
- delay equations
- differential equations
- backward Euler equations
- implicit equations/root finding
- model include/create directives
- source execution ordering and timestep semantics

Until this exists, native HumMod.EXE remains the definitive model execution reference.

## Engineering-bridge policy

Engineering bridges are allowed only when necessary to keep the educational simulator functional before native physiology is available.

Every bridge must:
- be explicitly labeled non-HumMod;
- expose the underlying native/source value separately;
- be bounded by external evidence;
- have regression tests;
- have a defined native HumMod replacement path;
- automatically disable when the corresponding native physiology becomes available.

The v1.3 empirical hypercapnic chronotropy bridge follows this policy and is temporary.

## Probe program

Use controlled probes to identify general model behavior, not to tune one scenario.

Initial matrix:

### Respiratory/autonomic
- isolated hypoxemia
- isolated hypercapnia
- combined asphyxia
- metabolic acidosis without primary hypercapnia
- hypocapnia/alkalosis
- recovery/reoxygenation

### Hemodynamic
- hemorrhage/hypovolemia
- distributive vasodilation
- increased intrathoracic pressure / PEEP
- reduced myocardial contractility
- increased afterload
- pulmonary vascular load

### Neurohumoral
- baroreflex perturbation
- low-pressure receptor perturbation
- catecholamine response
- RAAS activation
- ADH response
- brain-fuel failure
- skeletal-muscle metaboreflex

For each probe capture:
- HR and rhythm
- MAP
- CO/SV
- SVR/PVR
- right/left atrial pressures
- arterial/venous gases
- pH
- oxygen delivery/use
- autonomic pathway variables
- catecholamines
- organ/tissue failure flags
- timing to terminal states

## Release criterion

Do not judge success by whether one variable reaches a desired number.

A physiology change is acceptable when:
1. it improves native HumMod fidelity, or
2. it is an explicitly labeled evidence-based extension for a documented HumMod limitation.

The target is an auditable physiological digital twin, not a hand-tuned scenario generator.
