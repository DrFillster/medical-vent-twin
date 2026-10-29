# medical-vent-twin working standard

The accepted working baseline is commit `1a8f83ad212194750d79dd42128e1ee713756870` on `integration/v16-ui-v24-physiology`. The user accepted it on October 29, 2026 after local review ("Passes sniff test"). Read [ACCEPTED_BASELINE.md](ACCEPTED_BASELINE.md) before changing this integration.

## Preserve the accepted experience

- The served integration is `ards-twin-v1.0/web`. Do not mistake the separate `ards-twin-v0.5-progress/web` development UI for this site.
- Preserve the accepted bedside layout, element order, control IDs, CSS classes and styling. Do not redesign or regenerate the UI. Targeted version-label and runtime-wiring corrections are allowed when needed for the user's requested work.
- The displayed product version is v2.4. Use the actual v2.4 live session, with the accepted hold-scheduling fixes. Do not restore the broken v1.6-only factory call.
- Keep model limitations visible. Do not enable unsupported controls, silently ignore active inputs, fabricate comparison values, or describe untested physiology as validated.
- Keep physiology-equation changes separate from integration fixes. Preserve the accepted equations and parameters unless the user requests a physiology update.
- Do not deploy or modify `vent.defying-logic.com`. Acceptance of this baseline does not authorize publication, promotion to another branch, or changing the repository default branch.

## Required evidence for functional changes

Before stating that a change works:
1. Build the engine for the served integration and verify it matches the sources.
2. Run the integration guard and hold-scheduling regressions.
3. Exercise the actual bedside site and real worker in Chromium and WebKit: startup, advancement, ventilation changes, holds, continuous run/pause, reset/restart, export and mobile layout.
4. Verify the exact final committed SHA from a clean checkout, with accurate version labels and no session or uncaught browser errors.
5. Report the SHA, tested URL, tests/results, and any remaining failures or limitations. A successful build or test of another directory is insufficient.

Use the existing integration CI workflow and browser suite. Add focused regression coverage when a functional defect requires it. Do not weaken tests to make unsupported behavior appear to work. Documentation-only changes do not require rerunning unchanged browser workflows; retain the runtime SHA of the evidence.

## Repository ownership

ChatGPT/Work owns GitHub changes. The local Mac LLM is validation-only: it may pull, run, test, diagnose and report. It must not author repository changes, commit, push, create branches, open PRs or deploy. Do not ask it to implement proposed fixes.
