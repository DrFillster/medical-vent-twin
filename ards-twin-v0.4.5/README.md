# Mechanistic Lung Simulator v0.4.5 — mobile release candidate

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
