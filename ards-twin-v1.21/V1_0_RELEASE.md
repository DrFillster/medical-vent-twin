# v1.0 release

Status: **deployment candidate; local/runtime verification required before public promotion**

Branch: `main` / archive path `ards-twin-v1.0/`

## Product acceptance

Implemented:

- one-click reference aspiration ARDS teaching patient
- persistent Vent mechanics and recruitment state
- live reduced HumMod cardiopulmonary physiology
- active ventilator monitor: mode, PEEP, FiO2, respiratory rate, tidal volume
- systemic monitor: PaO2, PaCO2, pH, heart rate, mean arterial pressure, cardiac output
- respiratory mechanics: plateau pressure, total/intrinsic PEEP, driving pressure
- pressure/flow/volume waveforms
- PEEP and full ventilator-setting changes without starting a new patient
- inspiratory/expiratory holds and passive mechanics measurement
- session export
- mobile-first product shell
- research-only systemic-provider selection moved behind an advanced control
- legacy mechanics laboratory retained in source but hidden from the primary product
- static-host deployment contract; no production API or native HumMod runtime required
- explicit educational/synthetic/not-clinically-validated/not-for-patient-care labeling

## Regression caught during productization

The browser UI previously sent the systemic provider as `data.provider`, while the clinical worker inspected `payload.systemicMode`. That could route a requested live session into the replay constructor. v1.0 carries forward the fix that the worker to route `live-reduced-hummod` explicitly to `createBerlinLiveHumModSession`.

A dedicated `v1_0_product_smoke.test.js` now exercises live initialization, time advance, persistent PEEP change, and finite cardiopulmonary outputs.

## Promotion gate

Before public promotion run:

```sh
npm run build
npm test
npm run verify:deploy
npm run serve
```

Then verify the one-click reference patient in a real Chromium/WebKit browser and at one narrow mobile viewport.

This file does not claim those runtime checks have already been executed in the current authoring environment.

## Scientific boundary

This release is suitable for education/research evaluation. It is not a clinically validated ARDS model, treatment recommender, or patient-specific digital twin. Native HumMod calibration continues independently on the research workbench.
