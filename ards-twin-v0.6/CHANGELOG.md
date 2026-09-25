# v0.4.5 mobile release candidate — 2026-09-17

## Repairs
- Browser bundle contract and reproducible dependency-free build.
- Explicit scenario initialization across all four phenotypes.
- Controller/tracker rollback on rejected mechanics steps and thrown solver errors.
- Immediate abort on failed runFor steps, finite-duration validation, step budget.
- VC timing validation to ensure positive time remains for expiration.
- Reliable test-runner failure and timeout detection.

## Interface
- Responsive phone/tablet/desktop layout, accessible labels, 46 px controls.
- VC and PC modes, declared recruitment state, three starting examples.
- Cancelable worker, progress, bounded run duration, inline errors.
- Separate pressure/flow/volume plots, stale-output clearing, JSON export.
- Mechanics-only scope and conservative plateau availability.

## Evidence
- 127 existing checks plus 16 new checks pass; generated JSON report included.
- Three UI examples executed through the shared scenario module.
- Browser/mobile acceptance script supplied but not executed here: browser binary
  unavailable; download blocked. Deployment gates are in DEPLOYMENT_HANDOFF.md.

## Unchanged and retained
- Mechanical constitutive equations, recruitment equations, and phenotype values.
- Historical documents and benchmarks moved into history/v0.4.4.1.
- Gas exchange implementation retained in source but disabled in browser runs.
