# v1.3 HumMod fidelity test gates

## Governing objective

Reproduce native HumMod physiology first. v1.3 now uses a HumMod-first dependency-closure strategy: native perturbation trajectories determine which upstream source systems must enter the browser runtime. Clinical scenarios are downstream first-look evaluations and must not be used to tune the reduced model into agreement with expected clinical behavior.

See `docs/V1_3_HUMMOD_FIRST_STRATEGY.md` and `NATIVE_PERTURBATION_SUITE.json`.

## Gate 0 — source equation transcription

Status: PASS for the current myocardial-collapse subset.

Source-aligned modules now cover:
- tissue hemoglobin algebra;
- myocardial flow/tissue-PO2 implicit equation;
- myocardial metabolism;
- myocardial fuel selection;
- myocardial lactate mass balance;
- myocardial bicarbonate/CO2 mass balance;
- intracellular SID;
- cellular pH;
- myocardial function/failure hysteresis;
- asystole relation;
- fuel StableDelay derivative relation.

Known solver-identity limits remain explicit:
- myocardial PO2 uses bounded bisection, not a claimed copy of DES 2005 implicit-solver internals;
- StableDelay derivative is source-verified, but DES 2005 time-integration internals are not available.

## Gate 1 — native equation replay against run06

Status: PASS with numerical-solver caveats.

Recovered native artifact:
`hummod-v1.3-native-run06-raw-data-analysis-20261008.zip`

Replay method:
- native upstream state is supplied at each saved sample;
- source-aligned equations recompute downstream variables;
- this tests equation transcription, not reduced-model dynamic integration.

Observed maximum discrepancies after correcting source asymmetries:

- intracellular SID: approximately machine precision;
- myocardial pH: approximately machine precision;
- tissue bicarbonate-to-PCO2 conversion: approximately machine precision;
- myocardial O2 need: approximately machine precision;
- fuel minimum fractional delivery: approximately machine precision;
- myocardial function effect: approximately machine precision;
- myocardial tissue PO2: <= about 0.11 mmHg, within the native implicit-equation error limit of 0.17 mmHg;
- myocardial blood flow: about 0.4% maximum relative difference;
- myocardial O2 use: less than about 1% maximum relative difference.

Two source-transcription defects were found and corrected by this replay:
1. right-heart flow uses small/large basic conductances 0.4 / 10.0, not the left-heart 2.2 / 50.0;
2. right-heart basal metabolism is 0.0600 Cal/min/g, not the left-heart 0.0669.

The replay therefore served its intended purpose: source mismatches were treated as port defects and corrected from HumMod source, not tuned against desired physiology.

### StableDelay finding

Run06 shows myocardial fuel adequacy is not neutral at collapse:
- left FractUseDelay falls to about 0.786;
- right FractUseDelay falls to about 0.767;
- corresponding Function.FuelEffect falls to about 0.956 and 0.941.

Therefore the fuel-delay path cannot be omitted from a full dynamic-fidelity test.

At baseline and terminal run06 samples, saved `Fuel.Change` equals `K * (FractUse - FractUseDelay)` to floating-point precision. Some intermediate saved transition samples are not algebraically synchronous, consistent with solver substeps/evaluation ordering. Do not infer a different derivative equation from those sparse snapshots.

## Gate 2A — high-resolution native run07

Status: REQUIRED NOW.

Purpose:
- resolve 1-second ordering of myocardial flow, PO2, O2 lack, anaerobic metabolism, fuel adequacy, lactate, SID, PCO2, pH, function, and asystole;
- characterize StableDelay dynamics at sufficient temporal resolution;
- establish the native trajectory that the reduced dynamic subsystem must reproduce.

Use:
- `hummod-runner/native-v13-myocardial-collapse-probe.json`
- `docs/V1_3_NATIVE_RUN07_PROTOCOL.md`

Do not alter the run06 challenge parameters. Only increase observation density.


## Gate 2B — native perturbation reference suite

Status: REQUIRED NOW, IN PARALLEL WITH RUN07.

Purpose:
- determine the native HumMod dynamic range before adding browser approximations;
- explicitly test whether native HR exceeds 120/min under source-native stress conditions;
- characterize coupled HR, SA-node rate, stroke volume, cardiac output, pressure, peripheral resistance, sympathetic/vagal activity, baroreflex, low-pressure reflex, exercise drive, adrenal nerve, catecholamines, blood volume, and gas/acid-base state;
- identify which upstream HumMod systems materially mediate each response.

Use:
- `NATIVE_PERTURBATION_SUITE.json`
- `scripts/run-v13-native-perturbation-suite.ps1`
- `scripts/postprocess-v13-native-perturbation.js`
- `scripts/summarize-v13-native-perturbation-suite.js`

Initial source-native perturbations:
- bicycle exercise at 100 W;
- bicycle exercise at 200 W;
- hemorrhage/volume loss;
- isolated hypoxia;
- isolated hypercapnia.

Do not fit browser HR, SVR/TPR, catecholamine, or cardiac-output targets to expected clinical curves. The native trajectories are the reference surface.

## Gate 3 — isolated dynamic myocardial replay

Status: MYOCARDIAL DYNAMIC REPLAY BLOCKED ON RUN07; BROAD DEPENDENCY-CLOSURE EXPANSION ACTIVE.

Run07 remains required for the collapse-specific myocardial dynamic replay. In parallel, use the perturbation suite and broad dependency graph to rank and port upstream systems that are clearly missing from the browser runtime.

After run07:
1. initialize reduced myocardial dynamic states from the native initial sample;
2. drive only legitimate upstream HumMod boundary states;
3. advance the reduced subsystem at the same timeline;
4. compare the entire trajectory, not only the terminal state.

Primary comparison variables:
- myocardial blood flow and tissue PO2;
- O2 use / O2 lack;
- anaerobic calories and glucose use;
- FractUse / FractUseDelay;
- myocardial lactate;
- bicarbonate mass and PCO2;
- intracellular SID and pH;
- myocardial function;
- failure/asystole timing.

No clinical target values are allowed in this gate.

## Gate 4 — broad HumMod runtime integration

Status: ACTIVE INCREMENTALLY; NATIVE TRAJECTORY ACCEPTANCE NOT YET MET.

Expand coherent source closures into the browser runtime in dependency order. Initial priority domains are autonomic control, catecholamines/adrenal drive, blood-volume/venous-return physiology, and skeletal-muscle/exercise physiology, alongside the myocardial dynamic subsystem.

Each integrated domain must be compared against the applicable native perturbation trajectories. The old empirical decompensation bridges should be disabled only where source-native physiology has replaced them.

## Gate 5 — clinical first-look scenarios

Status: DOWNSTREAM.

After acceptable native fidelity:
- Berlin mild/moderate/severe ARDS phenotypes;
- hypoxemia and hypercapnia;
- ventilator/PEEP cardiopulmonary interactions;
- shock/decompensation;
- PEA/arrest;
- recruitment and ventilator maneuvers.

These runs ask whether HumMod-derived physiology produces clinically coherent behavior. They do not define the HumMod equations.

If a scenario appears clinically implausible:
1. determine whether the reduced model differs from native HumMod;
2. if yes, fix the port;
3. if no, document a native HumMod limitation and evaluate it against external evidence;
4. only then consider an explicitly labeled model extension.
