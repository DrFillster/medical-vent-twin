# HumMod / Vent v1.5 Handoff

Date: 2026-10-11
Active product branch: `v1.5`
Active HumMod core branch: `DrFillster/hummod-vent-core:main`
Physiology/control authority added by this handoff: **none**

## Current repository heads

At handoff review:
- `medical-vent-twin:v1.5`: `496d00c28c69a433c1629970be23caf208c6feea`
- `hummod-vent-core:main`: `9ff52fa949aacab482d91ec53ebfe6983cd79324`

Always re-read branch HEAD before changing code.

## Architecture decision

Do not continue rebuilding complete HumMod physiology in browser JavaScript or the native C++ service.

Target stack:

```
remote browser
    |
    | HTTPS / Cloudflare Access + Tunnel
    v
Mac native-engine :8771
    |
    +-- non-authoritative native myocardial diagnostics
    |
    +-- HumMod persistent-session adapter
            |
            v
         plain Wine
            |
            v
 unmodified pinned HumMod.EXE + model tree
```

Vent remains authoritative for ventilator mechanics, PEEP, recruitment/derecruitment,
compliance/resistance, plateau/total PEEP/driving-pressure measurements, waveforms,
and breath maneuvers.

HumMod is the intended whole-body physiology engine after the native session path
passes qualification and parity gates.

## Pinned native HumMod

Repository: `riliescu/hummod-standalone`
Revision: `8dab57e05631f779bf5020fe0dd51874d8ae98c1`
HumMod.EXE SHA-256:
`4243E8721F77A5FABF3128FAC5AC139588B20A8285D35D2021C6852D596803CB`
Size: 2,043,904 bytes.

Do not apply pinned menu/control IDs to another executable hash.

## Mac/Wine state

Implemented in `medical-vent-twin`:
- plain-Wine qualification harness;
- executable hash/size gate;
- process-scoped HumMod file-dialog control;
- save -> advance -> save -> restore -> re-save qualification;
- native SOLN conversion;
- Cloudflare native-engine boundary;
- browser credentialed read-only client;
- launchd service support;
- manual-only Mac/Wine qualification CI smoke.

Mac qualification command:

```sh
HUMMOD_ROOT=/path/to/hummod-standalone \
sh scripts/qualify-hummod-mac-wine.sh
```

A PASS proves persistent same-process advance/checkpoint/restore transport for the
pinned executable. It does not grant physiologic or control authority.

## Existing persistent-session implementation to reuse

`hummod-vent-core` already defines the narrow session contract and must remain
the source of truth for the HumMod worker protocol.

Relevant files:
- `contracts/session-api.schema.json`
- `src/session_manager.js`
- `src/native_worker_stdio.js`
- `src/native_runtime_adapter.js`
- `scripts/native-session-host.ps1`
- `docs/PERSISTENT_WORKER.md`

Contract:

```
initialize
set
advance
read
checkpoint
restore
terminate
```

The Windows host has already demonstrated persistent native operation. It includes
a source-whitelisted live-set path and explicitly disables legacy saved-solution
mutation as a live-control transport.

**Do not create a second incompatible session protocol in medical-vent-twin.**

## Immediate implementation target

Port/adapt the existing `hummod-vent-core` persistent-session transport to the
plain-Wine Mac path and place it behind the existing native-engine boundary.

Order:

1. Run the current Mac/Wine qualification on the hardwired Mac.
2. Reuse the core session command/response schema.
3. Implement Mac transport for initialize/read/advance/checkpoint/restore/terminate.
4. Keep `set` fail-closed until the live-control path is verified under plain Wine.
5. Add one-session deterministic integration tests.
6. Expose session status through native-engine only after local qualification.
7. Keep public Cloudflare endpoints read-only until browser-vs-native parity passes.
8. Only then evaluate controlled remote session commands.

Never expose Wine or HumMod.EXE directly through Cloudflare.

## Current physiology program

### Autonomic controller
Ursino/Magosso baroreflex, O2 chemoreflex, CNS-hypoxia, lung-stretch and separate
`f_sp/f_sh/f_v` channels exist in shadow mode. They have no control authority.

Principal remaining source blocker:
- exact Magosso/Ursino 2001 peripheral O2-CO2 interaction Eq. 1 transcription.

### Heart-period / HR
An interim Ursino/Magosso counterfactual HR exists, but full primary-source
parameter verification remains required before authority.

### Myocardial hypoxia/acidosis
Selected mechanistic direction:
- intracellular-pH excitation-contraction effects from Crampin/Smith;
- O2 -> mitochondrial energetics -> ATP/PCr -> Ca/cross-bridge function from
  Shimayoshi/Takeuchi/Matsuoka 2026.

Do not use a direct arterial PaO2-to-contractility or arterial-pH-to-Emax scalar.
Cell-force -> whole-heart elastance remains a separate validation gate.

### Native HumMod terminal behavior
Prior native runs showed that SA-node rate can remain present while actual HR and
cardiac output reach zero because myocardial function fails and asystole is latched.
Do not attempt to repair terminal collapse by adding sympathetic/chronotropic gain.

## Physician publication gate

The interim physician model is not publishable until live HumMod and the
published-model counterfactual expose, at the same patient time:

- HR
- MAP
- CO
- SV
- SVR

Current published-model availability:
- HR: available, counterfactual only.
- MAP/CO/SV/SVR: still blocked by source-complete downstream circulation/venous/
  contractility mappings.

No ad hoc scaling is permitted to clear this gate.

## Deployment

Current public design:

```
https://hummod.defying-logic.com
    -> browser UI

https://engine.hummod.defying-logic.com
    -> Cloudflare Access
    -> Cloudflare Tunnel
    -> Mac 127.0.0.1:8771
```

Keep:
`NATIVE_ENGINE_BIND=127.0.0.1`

Do not use router port forwarding as the production path.

## GitHub Actions policy

Use Actions sparingly.

- Native HumMod must not run in ordinary GitHub-hosted workflows.
- Mac/Wine qualification smoke is manual-only.
- Prefer local deterministic tests and Cloudflare/Mac deployment verification.
- Do not modify physiology to make CI green.

## Safety / fidelity rules

- No guessed physiologic gains, thresholds, transfer functions, or mappings.
- Every care-relevant modeled relationship requires explicit provenance.
- Shadow output must remain non-authoritative until validation and an explicit
  ownership decision.
- Preserve exact failure evidence.
- Never silently fall back to reduced/mock physiology when native HumMod is expected.
- Stable prior releases must remain recoverable through version control.
