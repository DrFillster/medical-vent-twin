# HANDOFF TO DEPLOYMENT LLM

## Mission

Deploy the current **progress-demo** build of the ARDS Clinical Twin.

This package is a development/research preview. Preserve all safety/provenance labels.

## Source of truth

Repository: `DrFillster/medical-vent-twin`

Branch used for this package:

`feature/berlin-virtual-patients`

Do **not** substitute `main`.

The package contains the current branch state at the commit recorded in `PACKAGE_COMMIT.txt`.

## Primary deployable application

Working directory:

`ards-twin-v0.4.5/`

Build:

```sh
npm install
npm run build
npm test
```

Then deploy the contents of:

`ards-twin-v0.4.5/web/`

as a static site.

Do not deploy the repository root as the public web root.

## Required public files

The static deployment must include at least:

- `web/index.html`
- `web/styles.css`
- `web/app.js`
- `web/worker.js`
- `web/clinical-worker.js`
- `web/engine.js`
- `web/clinical-cases.json`

Serve these files from the same origin so the Web Workers can load correctly.

## Demo workflow to show progress

1. Open the deployed page.
2. Confirm the visible banner says:
   `DEVELOPMENT PREVIEW · Synthetic cases · Not clinically validated · Not for patient care`
3. In **Clinical Twin preview**, leave the default:
   `Moderate ARDS — aspiration / intermediate recruitability`
4. Expand:
   **Prepare an executable Vent + HumMod session**
5. Click:
   **Load synthetic demo inputs**
6. Confirm the UI says:
   **SYNTHETIC DEMO DATA LOADED**
7. Click:
   **Initialize clinical session**
8. Demonstrate:
   - persistent session time
   - pressure / flow / volume waveforms
   - PEEP changes
   - full ventilator settings changes
   - VC-AC -> PC-AC transition at a breath boundary
   - inspiratory hold
   - expiratory hold
   - **Measure passive mechanics**
   - plateau pressure
   - total PEEP
   - intrinsic PEEP
   - driving pressure
   - clinical-session JSON export

## Critical labeling — DO NOT REMOVE

The current demo systemic replay is a **synthetic fixture**, not a real HumMod trajectory.

Do not describe or relabel fixture values as:

- real patient data
- deidentified patient data
- real HumMod physiology
- clinical validation
- clinically validated outputs

The nine Berlin ARDS cases are authored synthetic teaching/research cases.

The default reference-case recruitability label is a Vent mechanical construct.

Do not describe the case's intermediate recruitability label as a measured R/I classification.

The UI intentionally shows the R/I target as **Not assigned**.

The model airway-opening-pressure value is a mechanistic preset parameter, not a measured patient AOP.

## HumMod boundary

Do **not** bundle or publicly deploy:

- `HumMod.EXE`
- the HumMod upstream source/model tree
- modified HumMod assets

The static app does not require HumMod runtime files for this progress demo.

Real HumMod integration is designed as:

1. run HumMod externally;
2. export raw/canonical trajectory data;
3. load that trajectory into Vent;
4. compose it with the pulmonary simulation.

Accepted HumMod data schemas:

- `hummod-raw-series/v1`
- `vent-hummod-trajectory/v1`

## Deployment architecture

The progress build is intentionally deployment-neutral.

GitHub Actions is **not** required to host the site.

Any static-hosting mechanism is acceptable if it supports:

- HTTPS for production
- JavaScript
- Web Workers
- same-origin static assets
- browser JSON file upload

## Build verification

Before publishing, run:

```sh
cd ards-twin-v0.4.5
npm install
npm run build
npm test
```

If feasible also run:

```sh
npm run test:browser
```

Current automated status before packaging:

- node/unit/regression suite: green on the recent substantive branch state
- Chromium browser smoke: green on the recent substantive branch state
- WebKit narrow-mobile smoke: recently had a 320 px overflow; targeted CSS fix has been added and should be rechecked

Do not block the progress demo solely on GitHub-based deployment automation; deployment is being handled separately.

## Files worth reading before modifying deployment behavior

- `ards-twin-v0.4.5/docs/DEPLOYMENT.md`
- `ards-twin-v0.4.5/docs/WORKLOG.md`
- `ards-twin-v0.4.5/docs/HUMMOD_INTEGRATION.md`
- `ards-twin-v0.4.5/docs/HUMMOD_EXPORT_DISCOVERY.md`
- `ards-twin-v0.4.5/docs/HUMMOD_REMOTE_RUNNER.md`
- `ards-twin-v0.4.5/docs/REFERENCE_CASE_CALIBRATION.md`
- `ards-twin-v0.4.5/BUILD_PLAN.md`

## Do not redesign before deploying

For this handoff, prioritize a faithful deployment of the current progress build.

Do not:

- replace the clinical twin UI with a new design
- change the data schemas
- invent missing clinical values
- replace the synthetic demo with unlabeled hard-coded physiology
- remove provenance or warning text
- merge the feature branch into main as part of deployment
- vendor HumMod assets

If a host-specific adaptation is necessary, keep it minimal and document it.

## Expected result

A publicly or internally reachable static progress build that demonstrates:

- nine synthetic Berlin ARDS cases
- severity/recruitability separation
- persistent Vent mechanics
- state-preserving ventilator changes
- respiratory holds and passive mechanics
- recruitment-history support
- HumMod trajectory ingestion architecture
- synthetic demo systemic replay with explicit labeling
- provenance/readiness/calibration safeguards

This is a **progress demonstration**, not a claim of clinical validation.
