# v1.0 deployable Clinical Twin

## Deployment target

Publish the contents of:

`ards-twin-v1.0/web/`

as a static HTTPS site. Cloudflare Pages/static hosting is sufficient. No server-side API, native HumMod executable, or GitHub Actions deployment is required.

Required runtime files:

- `index.html`
- `styles.css`
- `app.js`
- `worker.js`
- `clinical-worker.js`
- `engine.js`
- `clinical-cases.json`

## Product scope

The primary v1.0 experience is the persistent reference aspiration ARDS teaching patient:

**Patient → Monitor → Trends & waveforms → Interventions**

The browser application exposes VC-AC ventilation, tidal volume, respiratory rate, PEEP, FiO2, inspiratory flow/pause, persistent recruitment state, inspiratory/expiratory holds, passive respiratory mechanics, gas exchange, and hemodynamic outputs.

Vent is authoritative for detailed pulmonary mechanics. The browser-capable reduced HumMod core supplies dynamic cardiopulmonary physiology. The native HumMod executable remains an external research/calibration environment and is not required by the deployed site.

The other authored Berlin/recruitability cases remain synthetic research/teaching phenotypes. v0.6 does not claim that every case has undergone the same native-HumMod calibration as the reference development pathway.

## Build and local verification

From `ards-twin-v1.0/`:

```sh
npm run build
npm test
npm run verify:deploy
npm run serve
```

For real-browser verification when Playwright browsers are available:

```sh
npm run test:browser
BROWSER=webkit npm run test:browser
```

The deployability verifier is intentionally local and does not require GitHub Actions.

## Safety/provenance requirements

The public build must retain visible statements that this is:

- an educational simulation;
- a synthetic patient/model;
- not clinically validated;
- not for patient care.

Do not describe the reduced browser core as the full HumMod executable or as a patient-specific digital twin. Do not describe engineering pulmonary-injury perturbations as clinically calibrated Berlin ARDS until that calibration has actually been established.

Do not bundle `HumMod.EXE` or the upstream HumMod model tree into the static web root.

## Cloudflare handoff

Cloudflare should serve `ards-twin-v1.0/web/` as the site root after the generated assets have been refreshed with `npm run build`.

No GitHub Actions workflow is required for deployment. The product branch is:

`main` / `ards-twin-v1.0/`

The research workbench remains separate so native HumMod calibration work can continue without destabilizing the deployable product.
