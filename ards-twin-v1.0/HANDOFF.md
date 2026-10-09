# HumMod v1.3 Iteration Handoff

## Purpose

This file is the single source of truth for the next build/test/deploy cycle.

Normal source-code iteration uses GitHub only.

Google Drive folder `vent` is reserved for:
- native HumMod SOLN files;
- large raw native-variable exports;
- screenshots;
- executable/hash evidence;
- native-run ZIP archives.

Do not create a handoff ZIP for normal source changes.

## Active branch

`v1.3`

## Current objective

Build and validate the HumMod-fidelity HR/hypoxia changes.

The current fidelity path must:
- keep the empirical HR overlay at 0 in source-aligned mode;
- make effective HR equal the HumMod SA-node rate before arrest;
- route hypoxia through the source-aligned brain tissue-PO2 / BrainInsult-PO2 / Brain-Function / SympsCNS path;
- preserve the native Brain-Function <= 0.1 autonomic branch;
- avoid any arterial-PO2-to-HR shortcut;
- keep v1.21 unchanged.

## Next cycle

1. Pull the latest `v1.3`.
2. Build:
   ```bash
   cd ards-twin-v1.0
   npm run build
   ```
3. Run focused tests:
   ```bash
   node test/hummod_brain_hypoxia_source_aligned.test.js
   node test/hummod_ards_autonomic_source_aligned.test.js
   node test/v13_hr_hypoxia_fidelity_guard.test.js
   node test/v13_extremis_chronotropy.test.js
   ```
4. Run:
   ```bash
   npm test
   ```
5. If tests pass, commit rebuilt browser artifacts to `v1.3`.
6. Update only the isolated preview path on `main`:
   `ards-twin-v1.3-preview/web/`
7. Do not modify v1.21.
8. Do not use GitHub Actions.
9. Verify the live preview:
   `https://hummod.defying-logic.com/ards-twin-v1.3-preview/web/`
10. Write `ards-twin-v1.0/HANDOFF_RESULT.json` using the schema in this repository and commit it to `v1.3`.

## Required browser checks

Confirm:
- preview HTTP 200;
- JS/CSS/worker assets HTTP 200;
- no browser console load errors;
- v1.21 still loads;
- effective HR equals HumMod SA-node HR before arrest;
- empirical HR overlay remains 0;
- brain tissue PO2 falls during severe hypoxemia;
- Brain-Function effect is displayed and trends;
- sympathetic and vagal firing are displayed and trend.

## Native-run policy

When a native HumMod run is requested:
- place the large/raw artifact in the Drive `vent` folder;
- use a predictable name such as:
  `v13-run07-native-YYYYMMDDTHHMMSSZ.zip`
- put the exact Drive filename into `HANDOFF_RESULT.json`;
- do not copy large native data into GitHub.

## Result policy

Every iteration must end with one committed `HANDOFF_RESULT.json`.

Do not send a free-form result as the primary handoff.

If a test fails:
- record the exact failing test name and message;
- do not change physiology merely to make the test pass;
- do not deploy unless this HANDOFF explicitly permits deployment with known failures.
