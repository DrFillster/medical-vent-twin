# Deploy the repaired mobile simulator

## Task for the receiving LLM

Use this package as the implementation. Finish the browser acceptance checks,
resolve any failures, then deploy through the owner's normal authorized workflow.
Do not substitute another broad rewrite of the numerical model. The owner wants
a working simulator on phones and desktop, not a second unused demo route.

## 1. Identify the existing deployment

- Inspect the repository and current deployment configuration for
  https://vent.defying-logic.com.
- Locate the actual simulator entry route and the links from the homepage. The
  supplied earlier package referred to `/ards-twin-v0.4/web/`; do not assume this
  is the current production route without checking.
- Preserve the landing page, manuscript routes, downloads, domain configuration,
  and unrelated files. Capture the current deploy identifier for rollback.
- Place this package in a branch or isolated working directory. Review its diff
  against the actual repository before integrating.

## 2. Integrate this release

- Port the provided `src/`, build script, runner, and new regression test into the
  corresponding existing project paths, resolving path differences explicitly.
- `web/` is the complete production static directory, already built. Serve all
  five files together from the simulator's route. If the simulator is at `/`,
  serve `web/index.html` there; otherwise retain the verified existing route and
  update homepage navigation to reach it.
- This release uses a classic worker with `importScripts` and a classic IIFE
  bundle. Do not restore ES imports of the global-only engine bundle.
- Rebuild with `npm run build` after source changes. Do not hand-edit engine.js.
- Keep relative asset paths. Return actual JavaScript/CSS for asset requests, not
  an SPA fallback HTML document. Serve JavaScript with its proper MIME type.
- If there is a Content Security Policy, permit the same-origin worker and
  same-origin scripts. Preserve existing security policy otherwise; do not
  blanket-disable it. No CDN, remote analytics, or external runtime library is used.
- Publish HTML with revalidation and deploy assets atomically. URLs include the
  release version to reduce stale-cache mismatches; bump it if you change assets.

## 3. Required automated acceptance

```sh
npm run build
npm test
npm install
npx playwright install chromium webkit
npm run test:browser
BROWSER=webkit npm run test:browser
```

For a deployed staging URL, include the final slash:

```sh
BASE_URL=https://YOUR-STAGING-HOST/VERIFIED-SIMULATOR-PATH/ npm run test:browser
BASE_URL=https://YOUR-STAGING-HOST/VERIFIED-SIMULATOR-PATH/ BROWSER=webkit npm run test:browser
```

Do not claim browser tests passed based solely on the Node test count. This
package's authoring environment could not install Chromium. Inspect the generated
screenshots, fix layout or behavior failures, and return actual browser reports.
If browser engines require operating-system dependencies, install them only
through the deployment environment's authorized setup process.

## 4. Phone acceptance before publishing

On an actual iPhone in Safari, check portrait and landscape:

- No page-wide horizontal scrolling or clipped controls at 320/390 CSS px.
- Inputs have comfortable touch targets, readable text, and usable numeric keyboards.
- Run all three starting examples. Pressure, flow, and volume plots remain legible.
- Switch all four phenotypes and both modes; explicit initial recruitment is visible.
- Run a long scenario and cancel immediately. The page remains responsive and a
  subsequent run works. Repeat after backgrounding and returning to the tab.
- Changing settings clears old results; impossible timing produces an inline error.
- In PC, plateau and driving pressure show unavailable, not invented measurements.
- Download run data and verify iOS offers a usable download/share workflow.
- Check pinch zoom, VoiceOver labels, keyboard focus, and reduced-motion behavior.
- Confirm the old homepage/manuscript/download links still work.

If any check fails, fix it, rebuild, rerun the affected checks, and attach evidence.

## 5. Publish and report

After the checks pass and the owner's normal deployment authorization applies,
publish and verify the actual live URL. Report the deployment/commit identifier,
route, numerical results, browser results, phone check status, and rollback target.
If physical iPhone testing cannot be performed, state that limitation explicitly;
do not label it device-verified.

## Scope boundaries

No source code in this ZIP was pushed or deployed by its author. Constitutive
mechanics and phenotype parameters are unchanged from the reviewed v0.4.4.1
package. Numerical consistency is not physiological or educational validation.
Do not advertise validated oxygenation, digital-twin personalization, ARDS severity
calibration, or improved learning outcomes. The browser runs mechanics only.
The manuscript still describes its prior evaluated version; amend it only with
accurate version-specific evidence after final deployment verification.
