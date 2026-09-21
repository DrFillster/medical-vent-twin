# ARDS Clinical Twin v0.6 deployable preview

This branch packages the existing Vent + live reduced HumMod work as a deployable browser product for education and research. The primary experience is a persistent synthetic aspiration ARDS reference patient: change the ventilator, advance time, perform holds/mechanics measurements, and observe mechanical, gas-exchange, and hemodynamic responses without resetting the patient.

**Scope:** educational simulation; synthetic patient/model; not clinically validated; not for patient care.

## Deploy

```sh
cd ards-twin-v0.5-progress
npm run build
npm test
npm run verify:deploy
npm run serve
```

Production is static: publish `web/` through Cloudflare or another HTTPS static host. Native HumMod and a server-side API are not production dependencies.

See `docs/DEPLOYMENT.md` for the deployment contract and `docs/HUMMOD_NATIVE_ARDS_ARCHITECTURE.md` for the continuing research/calibration path.

---

This directory contains the deployed v0.4.5 mechanics simulator **and** the active
v0.5 clinical digital-twin work on `feature/berlin-virtual-patients`.

The v0.5 path is still a development milestone, not a claim of clinical validation.

## v0.5 development status

Implemented on the feature branch:

- nine synthetic Berlin ARDS cases spanning mild/moderate/severe oxygenation severity
  and low/intermediate/high mechanical recruitability
- explicit separation of Berlin severity from mechanics phenotype
- case-readiness metadata that refuses to invent missing mode, FiO2, RR, absolute VT,
  recruitment state, or HumMod trajectory data
- pinned HumMod standalone revision and exact verified source-symbol mappings
- canonical HumMod trajectory serialization and deterministic replay
- external HumMod runner request contract with source-clock verification as a hard gate
- explicit inspiratory/expiratory holds and hold-derived respiratory mechanics
- composed Vent + HumMod session on one shared timeline
- persistent browser clinical worker
- state-preserving full ventilator changes applied at completed-breath boundaries
- browser Clinical Twin preview plus explicit executable-session setup
- generated browser case manifest with source-parity tests
- CI build, unit/regression testing, and Chromium/WebKit browser smoke jobs

The first real HumMod-backed reference trajectory is **not yet checked in**. Test fixtures
are clearly labeled as fixtures and must not be presented as HumMod-derived clinical data.

Key development documents:

- `BUILD_PLAN.md`
- `docs/WORKLOG.md`
- `docs/HUMMOD_INTEGRATION.md`
- `docs/HUMMOD_VARIABLE_MAP.md`
- `docs/HUMMOD_EXPORT_DISCOVERY.md`

The sections below preserve the v0.4.5 release-candidate documentation for the existing
mechanics lab.

This package repairs the v0.4.4.1 browser integration and supplies a responsive,
mechanics-only teaching interface. It is a release candidate for deployment
verification, not a claim of clinical validation.

**Deployment LLM: read `DEPLOYMENT_HANDOFF.md` first.**

## Run locally

Node 18+ is sufficient for the dependency-free core build and numerical tests.

```sh
npm run build
npm test
npm run serve
```

Open http://127.0.0.1:8765/ using an HTTP browser. Do not double-click index.html:
workers require the files to be served from an appropriate HTTP(S) origin.

`web/` already contains the complete built static site. No npm packages or server
application are needed in production. Keep all five files together:
`index.html`, `styles.css`, `app.js`, `worker.js`, `engine.js`.

## What changed

- A reproducible local-module bundle replaces the mismatched IIFE/ES-module import.
- The worker receives an explicit scenario, including initial recruitment and PEEP.
- A failed mechanics step rolls back controller and tracker state. `runFor` aborts
  rather than retrying indefinitely; the UI reports worker errors without stale results.
- Numerical computation runs in a cancelable background worker. A two-minute UI
  watchdog stops exceptionally long runs.
- Mobile layout stacks panels below 700 CSS pixels. Controls use 16 px text and at
  least 46 px heights, and waveforms resize their labels to the actual panel width.
- Both volume and pressure control are exposed. Three named starting examples help
  users begin; starting recruitment is explicit and editable for injury phenotypes.
- Settings use mL for tidal volume and L/min for flow, with conversion at the UI boundary.
- Gas exchange controls are omitted because this interface deliberately disables it.
- Plateau/driving pressure are withheld unless a suitable settled VC pause exists;
  pressure control is not mislabeled as an occlusion plateau.
- Pressure, flow, and volume have separate plots; completed run data can be exported.
- The test runner fails on crashed, timed-out, signaled, or empty test processes.

Constitutive mechanics, recruitment equations, phenotype parameters, and the gas
exchange module were not changed. Existing breath-metric algorithms are retained;
the UI selects a completed analyzed breath and gates plateau availability.

## Verification

143 checks passed across 22 test files under Node v24.19.0: 127 existing acceptance
checks plus 16 new regression/integration checks. `TEST_RESULTS.json` is produced
by `npm test`. Generated bundle and actual worker code were executed in a Node VM.
The three shipped starting examples completed with finite output.

**Real-browser layout/interaction tests were not executed in the authoring
environment.** Chromium was unavailable and its download was denied by the
network policy. Mobile CSS is implemented; browser and physical-device acceptance
remain deployment gates. No screenshot or iPhone validation is claimed.

```sh
npm install
npx playwright install chromium webkit
npm run test:browser
BROWSER=webkit npm run test:browser
```

The browser suite tests 320, 390, 768, and 1440 px widths, default VC and PC runs,
chart rendering, horizontal overflow, touch target heights, invalid timing,
result invalidation, cancellation/restart, and exported data. It writes evidence
under `browser-results/`. WebKit is an approximation; check an actual iPhone too.
Set `BASE_URL` to the complete simulator URL (with trailing slash) to test a staging
or published deployment instead of starting the local server.

## Scientific scope

This remains an educational exploration prototype. It is not patient-specific,
not calibrated to clinical cohorts, and not a clinical decision tool. Recruitment
labels describe mechanical constructs rather than ARDS grades. Gas exchange,
intrinsic-PEEP measurement, spontaneous effort, and educational effectiveness are
not validated here. Each run restarts its declared state; it is not a continuous
PEEP-history experiment. Existing gas-exchange code is retained only as legacy
source and is disabled in this interface.

The publication rewrite describes v0.4.4.1. This package does not rewrite the paper
or retroactively assign the new 143-check result to that version. Historical
manuscript and benchmark documents are retained under `history/v0.4.4.1/`.
