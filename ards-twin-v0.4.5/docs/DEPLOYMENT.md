# Deployment contract

The browser application is deployment-neutral. GitHub Actions is used for verification and generated-artifact refresh; it is **not** required as the deployment mechanism.

## Deployable web root

Publish the contents of:

`ards-twin-v0.4.5/web/`

as a static site.

Required runtime files include:

- `index.html`
- `styles.css`
- `app.js`
- `worker.js`
- `clinical-worker.js`
- `engine.js`
- `clinical-cases.json`

The current application does not require a server-side API for the Vent mechanics engine or fixed HumMod replay. Web workers are loaded from the same static origin.

## Build before deployment

From `ards-twin-v0.4.5/`:

```sh
npm run build
npm test
```

The build refreshes generated browser artifacts from source.

The generated files are:

- `web/engine.js`
- `web/clinical-cases.json`

Do not hand-edit generated files. Edit the canonical source under `src/` and rebuild.

## Browser verification

The project contains browser smoke coverage for Chromium and WebKit.

The verification workflow is useful as a quality gate but is not part of deployment.

A deployment mechanism may independently serve the `web/` directory through any static host that supports:

- HTTPS in production
- JavaScript
- Web Workers
- same-origin loading of the generated assets
- JSON file upload through the browser

## HumMod boundary

Do **not** bundle `HumMod.EXE`, the upstream HumMod model tree, or modified upstream HumMod assets into the public static site unless distribution/integration rights have been explicitly confirmed.

The web app accepts externally produced HumMod data in either:

- `hummod-raw-series/v1`
- `vent-hummod-trajectory/v1`

The intended architecture is:

1. HumMod runs externally.
2. The external runner emits a raw/canonical trajectory.
3. The user or deployment-specific integration supplies that trajectory to Vent.
4. Vent composes it with the pulmonary simulation.

This keeps the static deployment independent from the HumMod execution environment.

## Synthetic data boundary

The checked browser fixtures are test-only.

A public deployment must not relabel fixture HumMod values as:

- patient data
- real HumMod reference physiology
- clinical validation

The nine Berlin ARDS cases are explicitly synthetic authored teaching/research cases.

## Deployment verification checklist

Before promoting a build:

- run `npm run build`
- run `npm test`
- confirm `web/engine.js` and `web/clinical-cases.json` are current
- run or review Chromium browser smoke
- run or review WebKit browser smoke
- verify the default reference case still labels R/I as unassigned
- verify model AOP is labeled as a mechanistic construct
- verify fixed HumMod replay is labeled non-intervention-responsive
- verify no HumMod runtime binary or upstream model assets are present in the static web root

## Current branch

Active development branch:

`feature/berlin-virtual-patients`

Draft PR:

`#1 — v0.5: Berlin ARDS clinical twin + HumMod bridge foundation`

Keep deployment separate from merge readiness. The branch may be deployed for internal evaluation while the PR remains draft for ongoing real-HumMod and clinical-fidelity work.
