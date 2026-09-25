# ARDS Clinical Twin v1.0

Frozen public archive of the deployed ARDS Clinical Twin v1.0.

- Source baseline: `ards-twin-v1.0/` archive in the decompensation-promotion commit
- Git tag: `v1.0.0`
- Public app URL: https://vent.defying-logic.com/ards-twin-v1.0/web/
- Scope: educational/research simulation only; synthetic ARDS teaching patient; not clinically validated; not for patient care.

## Included model scope

This v1.0 archive includes the full decompensation model:

- oxygen-debt-driven shock / refractory-shock staging
- acidemia-mediated myocardial depression
- autonomic compensation coupled into the reduced HumMod cardiopulmonary runtime
- explicit terminal cardiovascular collapse with arrest rhythm `PEA`
- UI/session export fields for decompensation stage, oxygen debt, arrest reason, and arrest rhythm

Verification is regenerated from this archive during the v1.0 promotion.

## Verification

Regenerated during the v1.0 decompensation promotion:

- `npm run build`: pass; `web/engine.js` rebuilt from 52 source modules.
- `npm run verify:deploy`: pass; `deployable: true`, `failures: []`.
- `node test/v1_0_product_smoke.test.js`: pass.
- `node test/hummod_ards_decompensation_controller.test.js`: 7 passed / 0 failed, including terminal PEA collapse regressions.
- `npm test`: 360 passed, 2 assertion failures; the remaining failed file is `hummod_native_sweep.test.js` in the research-workbench native sweep path, not the static deployable product path.

The rebuilt browser engine contains the promoted decompensation controller and PEA arrest path.
