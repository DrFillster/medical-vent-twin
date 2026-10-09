# v1.3 HumMod-first strategy

## Decision

v1.3 no longer treats HumMod as a small set of equations embedded inside a largely hand-authored cardiopulmonary controller.

The new default is:

**Native HumMod defines the physiology surface. The browser runtime should reproduce progressively larger source dependency closures.**

Clinical expectations are not calibration targets. If browser behavior differs from native HumMod, fix the port first. If native HumMod itself appears clinically implausible, document that separately and evaluate it against external evidence.

## Why the strategy changed

The source-aligned work already demonstrated that substantial HumMod fidelity is recoverable:
- myocardial SID, pH, metabolism, fuel selection, function, and flow equations replay native state closely;
- native autonomic behavior explains the low-HR extremis trajectory without an empirical chronotropic bridge;
- brain hypoxia and the Brain-Function failure branch materially alter autonomic output;
- sparse reduced-order assumptions can therefore hide important upstream HumMod mechanisms.

The correct response is to expand HumMod coverage, not add more hand-tuned compensations.

## Native reference suite

`NATIVE_PERTURBATION_SUITE.json` is the primary characterization surface.

Initial perturbations:
- HumMod bicycle exercise at 100 W;
- higher-work bicycle exercise at 200 W;
- native hemorrhage/volume-loss stress;
- isolated hypoxia;
- isolated hypercapnia.

These runs must retain all native variables and explicitly report:
- HR and SA-node rate;
- stroke volume and cardiac output;
- systemic arterial pressure and peripheral resistance;
- SympsCNS and VagusNerve activity;
- baroreflex and low-pressure receptor activity;
- exercise sympathetic drive;
- adrenal nerve activity;
- epinephrine and norepinephrine pools;
- blood volume and right-atrial pressure;
- arterial PO2, PCO2, pH, and Brain-Function.

The suite summary directly reports whether native HR exceeds 120/min in any perturbation.

## Browser closure

The broad closure roots are defined in:
`src/hummod_ards_core_manifest.js`

The new `HUMMOD_V13_FIDELITY_ROOT_STRUCTURES` deliberately includes:
- cardiac output and heart-rate control;
- sympathetic and vagal pathways;
- baroreflex and low-pressure reflexes;
- catecholamines/adrenal nerve;
- brain flow/function/fuel;
- skeletal-muscle work, metabolism, flow, metaboreflex, and muscle pump;
- exercise control;
- blood volume and hemorrhage;
- gas exchange and acid-base outputs.

This is a dependency target, not a claim that the listed structures alone form an independently solvable HumMod executable.

## Porting rule

Prioritize source structures that meet either condition:
1. they materially mediate one or more native perturbation trajectories; or
2. they are required dependencies of already selected source structures.

Do not prioritize a subsystem merely because it produces a clinically familiar curve.

## Native execution

Native HumMod remains on the Mac.

GitHub Actions:
- build and test browser code;
- validate source-aligned modules;
- build the pinned-source dependency graph;
- deploy the isolated v1.3 browser preview.

The Mac:
- runs native HumMod;
- executes run07 and the perturbation suite;
- retains raw SOLN evidence;
- generates the native summaries;
- uploads large evidence archives to the Drive vent folder.

## Near-term implementation order

1. Complete native run07 and the perturbation suite.
2. Inspect the generated broad dependency closure and perturbation trajectories.
3. Rank missing browser subsystems by native causal participation.
4. Port/integrate autonomic + catecholamine + volume/venous-return + skeletal-muscle/exercise pathways as coherent source closures rather than isolated output formulas.
5. Compare browser trajectories against native perturbations.
6. Only after native agreement, use ARDS/critical-care scenarios as plausibility evaluations.
