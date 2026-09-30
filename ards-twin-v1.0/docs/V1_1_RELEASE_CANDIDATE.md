# ARDS Clinical Twin v1.1.0-rc.1

Status: **release candidate**, not yet the stable v1.1 release.

## Release objective

v1.1 makes scientific provenance a runtime property of the simulator rather than documentation alone.

The candidate does **not** claim that all physiology is validated or native HumMod. It makes the opposite distinction explicit: source-preserved HumMod elements, adapted HumMod elements, literature anchors, project calibration, and engineering assumptions are separately identifiable.

## Major changes

### Provenance
- machine-readable provenance registry;
- release-gated subsystem manifest;
- zero permitted `UNKNOWN` provenance records in the declared live clinical path;
- provenance IDs for equations, conditions, thresholds, transitions, topology choices, boundaries, and authored scenarios;
- monitor-output provenance map;
- live-session export contains provenance summary, release gate, bindings, and output provenance.

### Autonomic/hemodynamic transparency
The reduced autonomic controller now exposes separate provenance for:
- MAP target;
- baroreflex gain;
- autonomic/vascular/cardiac time constants;
- hypoxic and hypercapnic drive;
- sympathetic/parasympathetic target equations;
- HR response;
- contractility response;
- systemic conductance;
- venous V0 response;
- pulmonary vascular load;
- respiratory-acidosis myocardial depression.

These remain explicitly identified as engineering or literature-calibrated where appropriate. v1.1 does not relabel them as native HumMod.

### Circulation/decompensation transparency
Added explicit provenance for:
- reduced circulation topology;
- HumMod vascular/pump primitives;
- browser integration substep;
- mechanical pump-failure clamp;
- derived SVR/PVR;
- oxygen-delivery relation;
- critical extraction calibration;
- oxygen-debt integration;
- shock-state classifier;
- hypotension/asphyxia terminal conditions.

### ARDS mechanics
Synthetic baseline/low/moderate/high recruitability parameter sets are explicitly registered as authored teaching scenarios.

### HumMod future runtime
The v1.1 branch also documents the preferred v2 direction:
- do not require HumMod.exe as production infrastructure;
- treat the official pinned DES tree as the canonical model source;
- build DES -> IR -> headless interpreter/code generation;
- retain HumMod.exe as a reference/regression oracle.

A strict phase-0 DES source inventory parser and implementation-neutral HumMod runtime provider contract are included as non-production development infrastructure.

## What v1.1 does not change

The release candidate does **not** replace the current reduced physiology with a full headless HumMod runtime.

It does not make:
- the custom autonomic controller clinically validated;
- ARDS phenotype parameters patient-derived;
- the decompensation/arrest model a mortality predictor;
- the reduced browser circulation equivalent to full HumMod;
- the thorax bridge equivalent to measured esophageal-pressure physiology.

Those limitations are now more visible and auditable.

## Release-gated provenance scope

The v1.1 manifest covers physiology-affecting model elements in the live clinical path and exported monitor outputs.

Local temporary algebra variables inherit provenance from their tagged governing equation and dependency records rather than receiving redundant independent source claims.

The standard remains: every new physiologically meaningful constant, equation, condition, threshold, transition, topology decision, or authored scenario value must receive provenance before entering the release-gated live path.

## Required validation before stable v1.1

Run from `ards-twin-v1.0`:

```sh
npm test
npm run test:browser
npm run verify:deploy
npm run verify:v1.1-rc
```

Stable v1.1 requires all existing tests plus the RC provenance gates to pass.

## Known scientific debt carried intentionally into v1.1

Priority order for v1.2:
1. replace reduced autonomic/baroreflex/catecholamine logic with source-preserved HumMod behavior where feasible;
2. improve PEEP -> pleural/pericardial/hemodynamic coupling;
3. replace hand-authored ARDS phenotype parameters with dataset-constrained generation;
4. reduce circulation lumping;
5. separate reversible decompensation physiology from educational terminal-event logic.

## Candidate identifier

- package: `1.1.0-rc.1`
- branch: `v1.1-rc1`
- clinical validation: **false**
- intended use: education/research development only.
