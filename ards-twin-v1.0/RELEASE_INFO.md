# ARDS Clinical Twin v1.0

Frozen public archive of the deployed ARDS Clinical Twin v1.0.

- Source baseline commit: `6c36a6345498385d8c4b96616684a4ea4c3572ec`
- Rebuilt deploy artifact commit: `7453906282023fac33ada30957ee704f41a587ed`
- Git tag: `v1.0.0`
- Public app URL: https://vent.defying-logic.com/ards-twin-v1.0/web/
- Original live development path at release time: https://vent.defying-logic.com/ards-twin-v0.5-progress/web/
- Scope: educational/research simulation only; synthetic ARDS teaching patient; not clinically validated; not for patient care.

Verification at archive creation:
- `npm run build`: pass
- `npm run verify:deploy`: deployable true
- `npm test`: 347 passed; 2 known research-side `hummod_native_sweep` assertion failures
- Live browser smoke: pass at 320 / 390 / 768 / 1440 px
- Live bedside smoke: 72 / 72 pass
