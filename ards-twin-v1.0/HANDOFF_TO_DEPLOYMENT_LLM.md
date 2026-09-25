# v1.0 deployment handoff

Deploy branch:

`main` / `ards-twin-v1.0/`

Static site root:

`ards-twin-v1.0/web/`

Before publishing, from `ards-twin-v1.0/` run locally:

```sh
npm run build
npm test
npm run verify:deploy
```

Then publish the contents of `web/` through Cloudflare/static HTTPS hosting.

Do **not** deploy `main` as the v1.0 Clinical Twin. Do **not** require GitHub Actions for deployment. Do **not** bundle HumMod.EXE or the upstream HumMod model tree.

The intended default user path is:

**Start reference patient → Monitor → Trends & waveforms → Interventions**

The public page must retain the visible educational/synthetic/not-clinically-validated/not-for-patient-care warning.

The default live patient uses Vent mechanics plus the browser-capable reduced HumMod cardiopulmonary core. This must not be relabeled as the full native HumMod executable or as a clinically validated patient-specific digital twin.

See `docs/DEPLOYMENT.md` for the complete deployment contract.
