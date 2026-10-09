# HumMod v1.3 Iteration Control

## Control plane

Normal browser-model iteration is automated through GitHub Actions.

Workflow:
`.github/workflows/v13-preview-ci-deploy.yml`

Native HumMod remains Mac-only.

The other LLM is no longer part of the normal build/test/deploy loop.

## Active branch

`v1.3`

## Automated browser loop

A relevant push to `v1.3` triggers:

1. `npm ci`
2. `npm run build`
3. focused HumMod-fidelity tests
4. full `npm test`
5. `npm run verify:deploy`
6. Chromium browser smoke
7. validated static artifact upload
8. isolated preview sync to:
   `main/ards-twin-v1.3-preview/web/`
9. live HTTP/source-SHA verification
10. machine-readable result written to:
    `ards-twin-v1.0/HANDOFF_RESULT.json`

The workflow must never modify v1.21.

## Fidelity rules

The current source-aligned path must:
- keep empirical HR overlay at 0;
- make effective HR equal HumMod SA-node HR before arrest;
- route hypoxia through Brain-Flow -> BrainInsult-PO2 -> Brain-Function -> SympsCNS;
- preserve the native Brain-Function <= 0.1 autonomic branch;
- avoid an arterial-PO2-to-HR shortcut;
- preserve explicit limitations rather than tuning to clinical expectations.

## Native HumMod loop

Native HumMod runs execute only on the Mac.

Machine-readable request:
`NATIVE_RUN_REQUEST.json`

Current requested run:
`v13-run07-native-myocardial-collapse`

For native runs:
- use the pinned HumMod source/executable environment already established on the Mac;
- preserve raw SOLN and lossless variable extraction;
- package large evidence only in the Google Drive `vent` folder;
- use the naming pattern from `NATIVE_RUN_REQUEST.json`;
- record the exact Drive artifact filename in `HANDOFF_RESULT.json` or the next native-result record.

Do not run native HumMod in GitHub Actions.

## Deployment safety

The preview deployment is isolated at:

`ards-twin-v1.3-preview/web/`

Stable v1.21 must remain unchanged.

The preview includes `DEPLOY_SOURCE_SHA.txt`; live smoke must confirm that this exact source SHA is being served.

## Failure policy

If a test fails:
- preserve the exact failure;
- determine whether it is a source-port defect, stale expectation, infrastructure failure, or genuine model discrepancy;
- do not alter physiology solely to make the test green;
- do not deploy a failed browser build.

## Drive policy

Use Drive only for:
- native HumMod SOLN files;
- large raw native-variable exports;
- screenshots;
- executable/hash evidence;
- native-run ZIP archives.

Do not use handoff ZIPs for normal browser source iteration.


## Mac origin auto-sync

The public hostname currently serves the Mac deployment checkout. GitHub Actions
commits the validated preview to `main`; the Mac must fast-forward that checkout
before the public origin sees it.

One-time setup on the Mac deployment checkout:

```bash
git checkout main
git pull --ff-only origin main
bash .deploy/install-preview-sync-launchd.sh
```

After installation, launchd checks `origin/main` every 30 seconds and performs
only a clean fast-forward merge. It refuses to operate if:
- the checkout is not on `main`; or
- the working tree contains local changes.

No native HumMod process is run by this sync agent.
