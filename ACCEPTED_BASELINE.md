# Accepted v2.4 integration baseline

Accepted by the user on October 29, 2026: "Make this the new standard. Passes sniff test."

- Branch: `integration/v16-ui-v24-physiology`
- Accepted runtime SHA: `1a8f83ad212194750d79dd42128e1ee713756870`
- [Accepted commit](https://github.com/DrFillster/medical-vent-twin/commit/1a8f83ad212194750d79dd42128e1ee713756870)
- [Passing integration CI](https://github.com/DrFillster/medical-vent-twin/actions/runs/40883683915)
- Served directory: `ards-twin-v1.0/web`
- Product identity: **v2.4**, using the established v1.6 bedside layout.

This acceptance establishes the reference for future work. It does not promote a branch, deploy a site, or declare the full physiology suite passing.

## Accepted behavior and implementation

Manual Start patient and Quick start create the actual v2.4 live reference patient. The bedside UI reads the v2.4 hemodynamics and gas-exchange snapshot directly. Ventilator changes preserve patient state. Individual and combined holds, continuous advancement/pause, reset/restart, session export, and synthetic trajectory replay work.

The physiology is based on source commit `0c52dd1b575f283126bafe4bf935b36da883ea0b`. Two source modules contain accepted scheduling corrections: zero-pause inspiratory-hold activation in `simulation.js`, and mechanics-tick rounding of hold elapsed time in `clinical_twin_live_hummod_session.js`. The physiology equations and parameters were not tuned. The served engine is reproducibly generated from these sources.

The accepted UI includes corrected version labels, startup defaults, runtime wiring, field mappings, and explicit unsupported-feature labels. Its layout and styling are preserved; its scripts are not byte-for-byte copies of the earlier v1.6 scripts.

## Acceptance evidence

On the exact accepted runtime SHA, from a clean checkout:

- 13 integration checks passed.
- 3 hold-scheduling regression checks passed, including all three UI solver timesteps.
- 15 real-worker browser workflows passed in Chromium 151.0.7922.34.
- The same 15 workflows passed in WebKit 26.5.
- Both browser reports recorded the exact SHA and `workingTreeDirty: false`.
- Integration CI passed its guard, Chromium and WebKit jobs.

The browser workflows cover accurate identity/provider selection, explicit unsupported controls, manual start, finite monitor values, fixed advancement/charts, state-preserving PEEP/FiO2/RR/VT/flow/pause changes, individual/combined holds, continuous run at 2x and pause, export/provenance, reset/restart, Quick start, 390px mobile layout, synthetic replay, and absence of uncaught/session errors. They use the real worker and engine; the external native read-only shadow is excluded from local browser validation.

## Known limitations remain visible

The v2.4 live engine supports the reference aspiration patient in VC-AC. Other live cases and PC-AC are disabled. Anatomical-shunt and excess-lung-water inputs from the former v1.6 candidate are visibly disabled. Earlier parallel candidate and HumMod 2013 comparison models are absent; their values remain blank and explicitly unavailable.

The full source suite had **403 passing assertions across 76 files, with four existing failing files**:
- `clinical_twin_live_hummod_session.test.js`: prolonged respiratory-failure arrest expectation.
- `hummod_native_sweep.test.js`: baseline-setting and duplicate-ID assertions.
- `v24_terminal_state_controller.test.js`: asphyxial source-envelope assertion.
- `v0_6_product_smoke.test.js`: reports success but lacks the output markers required by the runner.

These failures were not resolved or suppressed by acceptance. WebKit coverage is not physical-device testing.

## Build, validate and run the accepted site

From the repository root, build only the served integration's engine:

```sh
node ards-twin-v0.5-progress/scripts/build.js --engine-output ards-twin-v1.0/web/engine.js
```

From `ards-twin-v0.5-progress`:

```sh
npm run test:integration
node test/integration_hold_scheduling.test.js
npm install --no-package-lock --ignore-scripts
npx playwright install chromium webkit
npm run test:integration:browser
BROWSER=webkit npm run test:integration:browser
PORT=8877 npm run serve:integration
```

The browser suite starts a local server for the correct served directory by default. Set `BASE_URL` to test an already-running instance. Do not use the generic development `serve` command to validate this accepted site.

## Publication scope authorized October 29, 2026

After accepting the baseline, the user separately requested publication to **https://hummod.defying-logic.com/** and **LINK ONLY** on https://vent.defying-logic.com/.

Publish the accepted `ards-twin-v1.0/web` assets from runtime SHA `1a8f83ad212194750d79dd42128e1ee713756870` at the HumMod root. Include `DEPLOY_SOURCE_SHA.txt` so the live build identifies its exact source. Keep the accepted UI/physiology unchanged and verify both real browsers against the published HTTPS URL.

The only permitted Vent content change in this publication is one homepage link to HumMod. Preserve its existing simulator, archive files, scripts and styles. Do not replace Vent with the v2.4 application or redirect the whole site. This publication does not change the repository's default branch or promote the integration onto another branch.
