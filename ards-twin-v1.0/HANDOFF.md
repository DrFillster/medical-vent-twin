# HumMod / Vent v1.5 Handoff

Date: 2026-10-11
Active product branch: `v1.5`
Active physiology/reference branch: `DrFillster/hummod-vent-core:main`
Physiology/control authority added by this handoff: **none**

## Governing architecture

The project is a **modular, persistent cardiopulmonary digital patient**.

HumMod is:
- an integrated source model;
- a native reference implementation;
- a comparator;
- a subsystem donor where its equations remain the best validated choice.

HumMod is **not** automatic physiologic ground truth and is **not** the intended universal whole-body authority.

The strongest validated model should own each subsystem. Competing models may run in shadow mode until source reproduction and independent validation support an ownership decision.

Canonical research source:
- `hummod-vent-core/docs/REFERENCE_MODEL_LEDGER.md`

## Target structure

```
remote browser / physician interface
              |
              v
 persistent canonical patient state
              |
   +----------+----------+----------------+
   |                     |                |
   v                     v                v
Vent mechanics     cardiovascular    control systems
                   / chamber plant   autonomic/resp
   |                     |                |
   +----------+----------+----------------+
              |
      gas / acid-base / O2
              |
      organ + metabolism
              |
      myocardial energetics
              |
      disease layers

HumMod native session runs alongside as reference/comparator
and may retain ownership only for individually selected subsystems.
```

## What Vent owns

Vent remains authoritative for:
- ventilator controller and mode;
- airway pressure/flow/volume waveforms;
- PEEP;
- high-resolution breath mechanics;
- resistance/compliance;
- recruitment/derecruitment;
- plateau/total PEEP/driving-pressure measurements;
- respiratory holds and bedside mechanics.

## Current candidate subsystem families

### Cardiovascular/autonomic
- Ursino 1998;
- Ursino & Magosso 2000;
- Magosso & Ursino 2001;
- Ursino & Magosso 2003.

### Integrated cardiopulmonary reference
- Albanese / Cheng / Ursino / Chbat 2016.

### Respiratory neural control
- Hennigs et al. 2026.

### Myocardial energetics/acidosis
- Crampin & Smith 2006;
- Shimayoshi / Takeuchi / Matsuoka 2026.

No direct arterial PaO2 -> contractility or arterial pH -> Emax scalar.

### Cellular stress -> chamber mechanics
Competing candidates:
- Kato / Himeno / Amano 2024 + Utaki/Shim lineage;
- CircAdapt/TriSeg as represented in MONARCH.

Neither has final authority yet.

### Oxygen delivery / extraction / microcirculation
Reference stack includes:
- Cain 1977;
- Schumacker & Cain 1987;
- Nelson et al. 1987;
- Ronco et al. 1993;
- Manthous et al. 1994;
- Roy & Secomb 2021;
- Munoz et al. 2020.

No universal DO2crit/SvO2/venous-PO2 threshold is authorized.

### Sepsis / inflammatory-autonomic disease layers
- Yamanaka et al. 2019;
- Foteinou et al. 2010;
- Scheff et al. 2011.

Disease layers must not be used to repair errors in normal physiology.

## Native HumMod reference path

Pinned comparison source:
- repository: `riliescu/hummod-standalone`
- revision: `8dab57e05631f779bf5020fe0dd51874d8ae98c1`
- HumMod.EXE SHA-256: `4243E8721F77A5FABF3128FAC5AC139588B20A8285D35D2021C6852D596803CB`
- size: 2,043,904 bytes.

The Mac/Wine persistent session work remains useful, but its purpose is now explicitly:
- source reproduction;
- counterfactual comparison;
- validation of translated HumMod equations;
- selected subsystem experiments.

It is not the architectural destination.

## Existing persistent-session contract

Reuse the existing HumMod reference-session contract from `hummod-vent-core`:

```
initialize
set
advance
read
checkpoint
restore
terminate
```

Relevant files:
- `contracts/session-api.schema.json`
- `src/session_manager.js`
- `src/native_worker_stdio.js`
- `src/native_runtime_adapter.js`
- `scripts/native-session-host.ps1`
- `docs/PERSISTENT_WORKER.md`

Do not create an incompatible second HumMod protocol.

## Current work order

**Do not start new physiologic implementation yet.**

First:
1. preserve and verify the complete model/reference ledger;
2. complete primary-source equation/parameter transcriptions;
3. define the canonical patient-state schema;
4. create the subsystem ownership map;
5. compare candidate cardiovascular/chamber models;
6. define source-reproduction experiments for every candidate;
7. identify independent validation datasets;
8. only then implement additional physiology in shadow mode.

Native Mac/Wine qualification can continue as infrastructure work, but it must not drive physiologic architecture decisions.

## Current hard blockers

- Magosso/Ursino 2001 Eq. 1 visual verification.
- Complete Ursino heart-period parameter transcription.
- Complete Hennigs equation/parameter transcription.
- Complete Crampin/Smith primary equation ledger.
- Final Shimayoshi source revision/reproducibility pin.
- Kato/Utaki vs CircAdapt/TriSeg chamber-mechanics decision.
- RV/septal/circulation integration for myocardial stress.
- Quantitative microcirculatory/sepsis extraction model.
- Source-driven ARDS phenotype distributions.
- Aortic CaO2-content chemoreflex: HOLD.
- Fever/temperature chronotropy: HOLD.

## Physician-facing requirement

The ultimate interface must expose clinically meaningful variables such as:
- HR;
- BP/MAP;
- SV;
- CO;
- SVR;
- PVR;
- CVP/RAP;
- PAP;
- SpO2/PaO2;
- PaCO2;
- pH;
- ventilator pressures;
- VT;
- compliance;
- oxygen-delivery/organ-perfusion context where validated.

The numbers must emerge from the selected subsystem models. No direct scaling is permitted merely to populate the monitor.

## Deployment

The current remote-access infrastructure remains valid:

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

Never expose Wine or HumMod.EXE directly through Cloudflare.

## GitHub Actions policy

Use Actions sparingly.
- Native HumMod should not run in ordinary hosted workflows.
- Mac/Wine qualification remains manual-only.
- Prefer local deterministic tests.
- Do not change physiology to make CI green.

## Fidelity rules

- No guessed physiologic gains, thresholds, transfer functions, or mappings.
- Every physiologic relationship requires explicit provenance.
- No subsystem gets authority before source reproduction and independent validation.
- Preserve competing model outputs in shadow mode during evaluation.
- Stable prior releases remain recoverable.
- Agreement with HumMod is not the final validation criterion.
