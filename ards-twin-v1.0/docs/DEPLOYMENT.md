# v1.5 deployable Clinical Twin

## Deployment target

Use a hybrid Cloudflare deployment:

```
https://hummod.defying-logic.com
    -> Cloudflare Pages/static web UI

https://engine.hummod.defying-logic.com
    -> Cloudflare Access
    -> Cloudflare Tunnel
    -> Mac 127.0.0.1:8771
    -> native-engine/
```

No router/NAT port-forward is required. The Mac initiates the outbound
`cloudflared` connection.

During migration, the browser v1.5 runtime remains physiologically
authoritative. The native engine is read-only/shadow until explicit
browser-vs-native parity gates transfer authority.

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

## Cloudflare Pages + Tunnel handoff

Cloudflare Pages continues to serve `ards-twin-v1.0/web/` as the web UI.

The Mac runs the native engine locally:

```sh
./scripts/build-native-mac.sh
./scripts/install-native-engine-launchd.sh
```

The native service remains bound to:

```
127.0.0.1:8771
```

Cloudflare Tunnel publishes that loopback service at:

```
https://engine.hummod.defying-logic.com
```

Current Cloudflare guidance recommends a remotely managed Tunnel for most
deployments. Create/manage the Tunnel in the Cloudflare dashboard and install
the connector on the Mac using the token command provided by Cloudflare.
Protect the hostname with a self-hosted Cloudflare Access application before
broader remote use.

The repository's locally managed `config.yml` template remains available as
a development/fallback path.

Set the deployed browser endpoint in:

```
ards-twin-v1.0/web/native-engine-config.js
```

to:

```js
window.MEDICAL_TWIN_NATIVE_ENGINE_URL =
  'https://engine.hummod.defying-logic.com';
```

The engine CORS allow-origin must remain:

```
https://hummod.defying-logic.com
```

The browser client uses credentialed read-only requests so a Cloudflare Access
session can be presented to the engine hostname.

GitHub Actions remains validation-only. It is not the production runtime or
deployment mechanism.
