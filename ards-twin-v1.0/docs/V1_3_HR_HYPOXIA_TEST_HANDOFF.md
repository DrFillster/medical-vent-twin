# v1.3 HR / hypoxia fidelity test handoff

## Objective

Build and deploy the current v1.3 branch so the user can test the revised heart-rate and hypoxia behavior.

Do not modify or replace v1.21.

## Branch

Repository:
`DrFillster/medical-vent-twin`

Branch:
`v1.3`

The relevant v1.3 source changes include:
- source-aligned HumMod brain tissue-PO2 / BrainInsult-PO2 pathway;
- removal of the empirical hypercapnic HR overlay from source-aligned HR;
- source Brain-Function effect fed into SympsCNS;
- diagnostic outputs for source SA-node HR, effective HR, brain tissue PO2, Brain-Function effect, sympathetic firing, and vagal firing;
- browser diagnostic plots and tiles.

## Required build

On the Mac/origin working copy:

```bash
git fetch origin
git checkout v1.3
git pull --ff-only origin v1.3
cd ards-twin-v1.0
npm run build
```

Do not use GitHub Actions.

## Required focused tests

Run:

```bash
node test/hummod_brain_hypoxia_source_aligned.test.js
node test/hummod_ards_autonomic_source_aligned.test.js
```

Then run the normal project suite:

```bash
npm test
```

If an unrelated pre-existing research-side failure remains, report it exactly. Do not alter physiology to make a test green.

## Required behavior checks

Confirm in source-aligned mode:

1. `effectiveHeartRatePerMin === sourceSaNodeHeartRatePerMin`.
2. `appliedEmpiricalChronotropicBoostPerMin === 0`.
3. Falling arterial O2 produces falling source-aligned brain tissue PO2.
4. BrainInsult-PO2 delay falls with sustained severe hypoxemia.
5. Brain-Function effect is supplied to SympsCNS when no external native-autonomic trajectory is present.
6. The native `Brain-Function.Effect <= 0.1` branch removes the normal baroreflex/low-pressure sympathetic contribution rather than using an invented hypoxic tachycardia rule.
7. No arterial-PO2-to-HR shortcut has been added.

## Browser diagnostics

The built page must display and trend:
- effective heart rate;
- HumMod SA-node rate;
- empirical HR overlay (expected 0 in source-aligned mode);
- PaO2;
- brain tissue PO2;
- Brain-Function effect;
- sympathetic firing;
- vagal firing;
- arterial pH.

The empirical overlay trace should remain at zero throughout a source-aligned run.

## Preview deployment

After build/tests pass, commit the rebuilt v1.3 browser artifacts to the v1.3 branch.

Then update **only** the isolated preview copy on `main`:

`ards-twin-v1.3-preview/web/`

Copy the rebuilt static web files from:

`ards-twin-v1.0/web/`

Do not modify the v1.21 runtime or make v1.3 the default.

Keep the v1.3 page clearly labeled:

`V1.3 DEVELOPMENT PREVIEW`

Live target:

`https://hummod.defying-logic.com/ards-twin-v1.3-preview/web/`

## External verification

Verify:
- preview returns HTTP 200;
- JS/CSS/worker files return HTTP 200;
- no browser console load errors;
- v1.21 still loads unchanged;
- v1.3 diagnostics render;
- empirical HR overlay reads 0;
- source SA-node HR and effective HR agree before arrest.

## Report back

Return:
- v1.3 source/build commit SHA;
- preview deployment commit SHA;
- focused-test results;
- full-test result;
- exact live URL;
- whether an origin restart was required;
- any browser-console errors;
- any remaining physiology discrepancy observed during smoke testing.

Do not tune HR to a clinical expectation during this deployment. This is a HumMod-fidelity test.
