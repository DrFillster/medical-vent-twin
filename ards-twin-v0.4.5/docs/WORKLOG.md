# Implementation Work Log

This file is an append-only record of substantive work on the ARDS digital-twin build. It records what changed, why, and what has or has not been verified.

## 2026-09-17 — v0.5 clinical digital-twin foundation

### Direction confirmed

- The application will start from realistic **synthetic Berlin ARDS patients**, not generic mechanics presets presented as clinical severity.
- Berlin severity and recruitability remain independent axes.
- HumMod is part of the target architecture as the systemic/whole-body physiology engine.
- The Vent project remains responsible for detailed ventilator interaction, lung mechanics, recruitment/derecruitment, waveforms, hold maneuvers, and ventilator measurements.
- HumMod integration will occur through an explicit provider/adapter boundary rather than embedding guessed HumMod variable names into the core lung model.

### Existing branch work reviewed

Branch: `feature/berlin-virtual-patients`

Existing work retained:

- `src/clinical_scenarios.js`
  - Berlin cohort envelopes
  - direct Berlin oxygenation classification helper
  - recruitability as a separate mechanical axis
  - nine combination descriptors
- `src/simulation.js`
  - persistent PEEP-setting change support
  - intervention logging foundation
- `src/digital_twin_contract.js`
  - normalized source-neutral systemic snapshot contract
- browser/bundle exports for clinical scenario and digital-twin modules
- unit tests for clinical scenarios, setting changes, and digital-twin contract

### HumMod repository reconnaissance

Reviewed the public HumMod standalone repository currently available at `riliescu/hummod-standalone`.

Observed packaging includes:

- model hierarchy directories including `Context`, `Control`, `Display`, `Docs`, and `Structure`
- root model-description files including `HumMod.DES` and `Model.DES`
- a Windows executable (`HumMod.EXE`)
- documentation organized by physiologic domains, including acid-base and air-supply material

Implication: direct execution inside the current static browser package is not the correct first integration target. The project will support both deterministic HumMod replay and a future live provider service through one normalized adapter contract.

No HumMod source files or executable have been copied into this repository.

### Documentation added

- `BUILD_PLAN.md`
  - product intent
  - two-engine architecture
  - non-negotiable clinical modeling rules
  - staged HumMod integration strategy
  - milestones and acceptance criteria
  - verification and documentation policy

### Verification status

Repository changes are committed on GitHub. A complete local `npm test` / browser smoke run has **not yet been confirmed in this work session** because earlier local access to GitHub was unavailable. Do not interpret committed code as test-verified until CI or a runnable checkout confirms it.

### Next implementation steps

1. Create explicit nine-case clinical catalog with named synthetic patients and provenance labels.
2. Add executable tests for that case catalog.
3. Implement configurable HumMod snapshot mapping without guessed upstream variable names.
4. Add deterministic replay provider as the first end-to-end HumMod-compatible path.
5. Continue bedside mechanics work: inspiratory hold, expiratory hold, total PEEP, plateau pressure, and driving pressure measurement.

## 2026-09-17 — first implementation pass after build-plan approval

### Clinical case catalog implemented

Added `src/berlin_case_catalog.js`.

The catalog now contains nine explicit named synthetic cases spanning the full 3 x 3 matrix of:

- Berlin severity: mild / moderate / severe
- recruitability: low / moderate / high

Each case contains:

- stable case ID and display name
- `synthetic: true`
- an explicitly authored etiology/pattern/narrative marked as a synthetic scenario assumption
- independent recruitability mechanics preset
- cohort-calibrated P/F, PaCO2, PEEP, VT/PBW, plateau, driving-pressure, compliance, and resistance targets inherited from the existing evidence layer
- explicit separation of published cohort envelopes from individual-patient truth
- an unpopulated HumMod linkage rather than invented systemic physiology
- provenance describing cohort, mechanics, scenario, and systemic-source status

Patient-specific tidal volume in mL, FiO2, and respiratory rate remain unset rather than fabricated. Patient-specific VT in mL will require a validated PBW workflow and an explicitly authored starting ventilator state.

Added `test/berlin_case_catalog.test.js` covering:

- nine unique synthetic cases
- complete 3 x 3 matrix
- Berlin/recruitability independence
- evidence-versus-assumption provenance
- refusal to fabricate patient-specific calculated ventilation fields
- explicit pending HumMod linkage
- deterministic case lookup and unknown-case failure

Updated browser and bundle exports so the clinical catalog is part of the public simulator API.

### HumMod bridge foundation implemented

Added `docs/HUMMOD_INTEGRATION.md` documenting:

- Vent-versus-HumMod solver ownership
- domains that require an explicit coupling decision to avoid circular authority
- exact-path mapping requirements
- replay-provider architecture
- future live-provider architecture
- source/version metadata requirements
- first end-to-end HumMod integration target
- licensing/distribution boundary

Updated `src/digital_twin_contract.js` so normalized snapshots retain optional `modelVersion` metadata in addition to provider, subject ID, and run ID.

Added `src/hummod_adapter.js` with two initial integration primitives:

1. `createHumModSnapshotMapper()`
   - requires an explicit HumMod model/source version
   - accepts only caller-supplied exact source paths
   - has a closed list of normalized target fields
   - performs no fuzzy matching and no implicit unit conversion
   - fails when required verified source fields are missing
   - normalizes through the existing digital-twin contract

2. `createHumModReplayProvider()`
   - accepts a deterministic sequence of normalized snapshots
   - satisfies the existing digital-twin provider interface
   - samples state deterministically by simulation time
   - deliberately rejects `applyIntervention()` because a fixed source trajectory cannot legitimately invent a physiologic response that was not represented in that trajectory

Added `test/hummod_adapter.test.js` covering:

- exact-path mapping
- model/source version preservation
- missing required source field failure
- unsupported target rejection
- deterministic replay sampling
- explicit rejection of unsupported intervention response synthesis

Updated browser and bundle exports for the HumMod adapter.

### Automated verification infrastructure

No GitHub Actions workflow existed for this branch. Added `.github/workflows/ards-twin-tests.yml` to run `npm test` under Node 22 on pushes to `main` and `feature/berlin-virtual-patients` and on pull requests affecting the ARDS twin.

Immediately after workflow creation, the GitHub Actions API still reported zero runs for the branch. Therefore **the newly added tests are committed but not yet CI-confirmed** in this work session. This is recorded explicitly rather than claiming a passing build.

### Current next steps

1. Obtain/produce one real HumMod export or trajectory and document its exact upstream revision and verified variable paths.
2. Create the first end-to-end moderate Berlin ARDS case with attached HumMod systemic replay data.
3. Implement clinically trustworthy bedside measurements: expiratory hold/total PEEP, inspiratory hold/plateau, then driving pressure.
4. Add a patient-first UI selector and provenance display after the measurement/runtime primitives are trustworthy.

## 2026-09-17 — explicit bedside occlusion measurements

### Inspiratory and expiratory hold mechanics implemented

Updated `src/simulation.js` with explicit bedside ventilator maneuvers:

- `requestInspiratoryHold(durationSec)`
- `requestExpiratoryHold(durationSec)`
- one-maneuver-at-a-time state management
- zero-flow airway occlusion during the hold
- ventilator cycle clock frozen during the occlusion
- maneuver request/start/complete events in the intervention log
- late-hold median pressure and flow captured as explicit measurements
- inspiratory hold reports plateau pressure
- expiratory hold reports total PEEP and the contemporaneous set PEEP
- trace rows carry maneuver labels so future waveform UI can annotate the occlusion window

The expiratory hold is deliberately scheduled at end expiration rather than during ordinary expiratory flow. This fixes the conceptual problem in the legacy metrics layer where airway pressure was clamped to set PEEP and could therefore hide trapped alveolar pressure.

Added `test/hold_maneuvers.test.js` covering:

- explicit inspiratory-hold plateau measurement
- explicit end-expiratory total-PEEP measurement
- zero-flow behavior during both holds
- a high-resistance reference case that exposes pressure above set PEEP during an expiratory hold
- maneuver concurrency rejection
- refusal of the core summary to fabricate an unmeasured driving pressure

GitHub Actions run `35276933328` for commit `b5a7190a686a9d75cb9322742040983590c744ff` completed successfully, including the new maneuver regression tests.

### Passive mechanics derivation layer added

Added `src/bedside_measurements.js` and `test/bedside_measurements.test.js`.

This layer consumes completed hold measurements and derives:

- intrinsic PEEP from total PEEP versus set PEEP
- an explicit effective end-expiratory pressure reference
- airway driving pressure from plateau pressure versus that reference

Because the Vent mechanics model contains an explicit airway-opening pressure (AOP), the effective end-expiratory reference is not allowed to fall below set PEEP, measured total PEEP, or modeled AOP. This prevents a misleading driving-pressure value when set PEEP is below a closed-airway threshold.

The derivation preserves provenance separating measured hold pressures from the mechanical phenotype's AOP parameter. It remains labeled as an educational/research simulator derivation rather than clinical validation.

Browser and bundle exports now expose the hold maneuver type and passive-mechanics derivation function.

### Verification status

The hold-maneuver implementation passed CI. A newer CI run covering the passive-mechanics derivation and export changes was queued/in progress when this entry was written; do not claim that newer head as verified until that run completes.

### Next implementation steps

1. Wire the passive-mechanics derivation directly into the Simulation measurement summary and the future patient UI.
2. Replace/deprecate the legacy waveform-based auto-PEEP metric in favor of explicit expiratory-hold measurement.
3. Continue HumMod source mapping using exact upstream variable paths and a pinned upstream revision.
4. Build the first moderate-Berlin end-to-end case combining Vent measurements with HumMod replay systemic state.

## 2026-09-17 — pinned HumMod standalone source map

### Verification update

GitHub Actions run `35277207032` for commit `726fdb09482a6f2489018b590b686b6c74a98f81` completed successfully. This verified the passive-mechanics derivation and associated browser/bundle exports described in the prior work-log entry.

### Upstream revision pinned

HumMod source inspection is now tied to:

- repository: `riliescu/hummod-standalone`
- revision: `8dab57e05631f779bf5020fe0dd51874d8ae98c1`

Added `src/hummod_standalone_manifest.js` and `docs/HUMMOD_VARIABLE_MAP.md`.

Verified source symbols at that revision include:

- `PO2Artys.Pressure` -> arterial PaO2
- `CO2Artys.Pressure` -> arterial PaCO2
- `BloodPh.ArtysPh` -> arterial pH
- `Heart-Rate.Rate` -> heart rate
- `SystemicArtys.Pressure` -> mean systemic arterial pressure
- `CardiacOutput.Flow(L/Min)` -> cardiac output in L/min

The source manifest records the exact defining `.DES` file for each symbol and is exported through the browser API.

### Deliberately unresolved mappings

The following verified HumMod symbols remain intentionally excluded from direct normalized mapping:

- `PO2Artys.Sat(%)`: source is percent while the normalized twin contract expects a fraction; explicit transform required.
- `RightAtrium.Pressure`: source is right atrial pressure; use as normalized CVP requires an explicit semantic decision.
- `O2Total.Outflow`: whole-body oxygen-use candidate; source units require end-to-end verification before exposing mL/min.
- `CO2Total.Inflow`: whole-body carbon-dioxide-production candidate; source units require end-to-end verification before exposing mL/min.

Timestamp ownership is assigned to the execution/export envelope rather than an invented physiological HumMod symbol.

### Export binding boundary implemented

Added `src/hummod_standalone_binding.js` and tests.

`createHumModStandaloneExportMapper()` requires:

- the exact pinned HumMod revision
- an explicit exporter version
- an explicit timestamp path from the execution envelope
- explicit serialized paths keyed by verified HumMod source symbol

It rejects:

- a different/unverified HumMod revision
- unknown HumMod symbols
- symbols whose unit conversion is pending
- symbols whose semantic mapping is pending

This keeps the upstream model identity distinct from the JSON serialization shape and prevents a future exporter from silently redefining physiology.

### Current verification status

A new CI run for the manifest/binding commits was queued when this entry was written. Do not claim that branch head as verified until the corresponding GitHub Actions run completes.

### Next implementation steps

1. Verify/define the HumMod export serialization generated by the selected runner.
2. Trace whole-body O2/CO2 units through component structures and add explicit transforms only after verification.
3. Produce a real HumMod trajectory export with revision/exporter metadata.
4. Attach that replay to the moderate Berlin + moderate recruitability reference case.
5. Continue replacing legacy waveform heuristics with the explicit hold-based bedside-measurement layer.

## 2026-09-17 — canonical HumMod trajectory serialization

### Canonical export contract implemented

Added `src/hummod_export_contract.js` and `test/hummod_export_contract.test.js`.

The browser/runtime now has a versioned trajectory serialization boundary: `vent-hummod-trajectory/v1`.

The contract requires:

- the exact pinned HumMod standalone repository and revision
- an explicit exporter version
- a stable trajectory ID
- an explicit list of approved HumMod source symbols
- execution timestamps owned by the export envelope
- strictly increasing timestamps
- every declared source symbol to be present with a finite numeric value in every row

It rejects:

- revision mismatch
- unknown or pending HumMod symbols
- undeclared row symbols
- missing values
- non-finite values
- duplicate or non-monotonic timestamps

The canonical row shape preserves HumMod symbol identity directly under `values`, for example `values['PO2Artys.Pressure']`. Normalization still occurs only through the pinned standalone binding and normalized digital-twin contract.

Added helpers to:

- validate a canonical HumMod export
- convert an export to normalized twin snapshots
- create a deterministic HumMod replay provider directly from the export

No physiologic trajectory was fabricated or checked into the repository. Test values are explicitly fixture data used only to verify serialization and mapping behavior.

Browser and bundle APIs now export the trajectory contract.

### Verification status

GitHub Actions run `35280012377` was queued for branch head `88f9ebe12aa44f2dd107d60d299e0826e73be837` when this entry was written. Do not claim this newest head as verified until that run completes.

### Next implementation steps

1. Produce an actual export using a HumMod runner at the pinned revision and validate it against `vent-hummod-trajectory/v1`.
2. Bind that trajectory to `berlin-moderate-moderate-aspiration` as the first end-to-end systemic replay case.
3. Add a clinical-twin runtime that advances Vent mechanics and samples the attached systemic provider on one timeline while retaining separate solver provenance.
4. Wire explicit hold-derived mechanics into the patient-facing runtime and retire legacy waveform auto-PEEP as a clinical-facing value.


## 2026-09-17 — canonical HumMod replay runtime and CI repair

### Canonical export normalization bug fixed

GitHub Actions exposed one failing assertion in `hummod_export_contract.test.js`.

Root cause:

- canonical HumMod trajectory rows intentionally preserve exact source symbols as literal keys, e.g. `PO2Artys.Pressure`
- the generic HumMod mapper interprets dot-separated paths as nested object paths
- the export contract therefore produced valid raw rows but normalized fields resolved to `null`

Fix:

- retain the canonical raw export format unchanged
- expand each validated row into a temporary nested mapping object only during normalization
- preserve exact raw HumMod symbol identity and revision/exporter provenance
- do not introduce fuzzy matching, implicit unit conversion, or mutate the source export

Commit: `43cf2e96499d1ef8900b23f7ee1879422b4f0879`.

### Berlin + HumMod replay composition runtime added

Added `src/clinical_twin_runtime.js`.

`createBerlinHumModReplayRuntime()` now binds:

- one named synthetic Berlin ARDS case from the case catalog
- one validated canonical HumMod trajectory export
- the pinned HumMod source revision and exporter provenance
- deterministic systemic state sampling on the shared simulation timeline

The runtime deliberately labels itself as `deterministic-systemic-replay`, not live bidirectional coupling.

It explicitly refuses to synthesize a HumMod systemic response to arbitrary Vent interventions. A PEEP change or other Vent intervention can only have a systemic HumMod response when a live provider is available or when that intervention is represented by an authored HumMod trajectory.

Added `test/clinical_twin_runtime.test.js` covering:

- moderate Berlin / moderate recruitability case binding
- HumMod revision provenance
- deterministic systemic initialization and sampling
- subject/run identity preservation
- failure before initialization
- refusal to fake systemic intervention response

Browser and bundle exports now expose `createBerlinHumModReplayRuntime`.

### Verification status

Latest branch head at the time of this entry: `95733933a777cf89fccaedc7319120ba7fe9972f`.

GitHub Actions run `35284416884` was in progress when this entry was written. Do not mark this head as verified until that exact run completes successfully.


## 2026-09-17 — composed Vent + HumMod clinical session

### End-to-end session composition added

Added `src/clinical_twin_session.js` and `test/clinical_twin_session.test.js`.

The session layer now composes:

- one authored synthetic Berlin ARDS case
- Vent lung/ventilator mechanics
- explicit initial recruitment state
- explicit VC-AC or PC-AC ventilator settings
- a validated canonical HumMod trajectory replay
- one shared simulation clock

Design constraints:

- Vent browser gas exchange is disabled in the composed session so it does not compete with HumMod-derived gas/acid-base state.
- Vent owns pulmonary mechanics, recruitment, waveform state, holds and ventilator interventions.
- HumMod replay owns systemic state present in the validated trajectory.
- Fixed replay does not synthesize systemic response to arbitrary Vent interventions.
- The session refuses to extrapolate beyond the end of the HumMod trajectory.
- Missing ventilator settings or recruitment state are rejected rather than guessed.

The session snapshot exposes:

- case identity, Berlin severity and recruitability
- current ventilator settings
- compartment volumes, flows, pressures and recruitment
- explicit hold-derived respiratory mechanics
- current HumMod systemic snapshot
- coupling/provenance status
- session intervention history

### Unified bedside-mechanics summary

Updated `Simulation.measurementSummary()` to use the existing explicit hold derivation layer.

The core summary now returns plateau pressure, total PEEP, intrinsic PEEP, effective end-expiratory reference and driving pressure only when the required zero-flow hold measurements are available. Before both holds exist, the summary remains explicitly incomplete.

### Clinical case readiness layer

Added `src/clinical_case_readiness.js` and tests.

The readiness API makes the future patient UI distinguish:

- fields already authored
- cohort-calibrated targets
- required explicit case inputs
- required external HumMod data

It specifically prevents the UI from silently fabricating:

- ventilator mode
- FiO2
- respiratory rate
- absolute tidal volume
- initial recruitment state
- HumMod trajectory linkage

All nine Berlin cases are exposed through the readiness API.

### Verification status

The prior branch head `3f3bf7255b2061621dece81e96a2da16d00f53a4` passed GitHub Actions run `35284451153`.

The newer composed-session/readiness commits were pushed after that successful run and require their own CI confirmation before merge.


## 2026-09-17 — patient-first browser preview and generated manifest

### Clinical Twin preview added

The existing mechanics lab remains intact while a new patient-first clinical preview is introduced above it.

The preview:

- lists all nine synthetic Berlin ARDS cases
- defaults to the moderate Berlin / intermediate-recruitability aspiration reference case
- displays Berlin severity and recruitability as separate axes
- displays the authored case narrative
- shows whether the case is executable
- shows each readiness field as ready, cohort-calibrated, required explicit input, or required external data
- explicitly marks HumMod trajectory attachment as external data still required

The preview does not fabricate missing ventilator settings, absolute VT, recruitment state, or systemic physiology.

### Browser manifest generation

Added `scripts/build-clinical-manifest.js`.

The browser-facing `web/clinical-cases.json` is now generated from:

- `src/berlin_case_catalog.js`
- `src/clinical_case_readiness.js`

Added `test/clinical_case_manifest.test.js` to fail if the browser manifest diverges from canonical source case identity, narrative, severity, recruitability, readiness status, values, provenance, or notes.

The normal `npm run build` now regenerates this manifest before rebuilding `web/engine.js`.

### Browser smoke expansion

Browser smoke coverage now checks:

- nine clinical cases load
- the intended moderate/intermediate reference case is selected by default
- severity/recruitability render correctly
- the case remains explicitly non-executable while HumMod and required inputs are missing
- switching to the severe/high-recruitability case updates the clinical summary
- the existing mechanics lab still runs afterward

### Build pipeline

GitHub Actions now:

1. builds the browser artifacts,
2. runs unit/regression tests,
3. publishes `web/engine.js` and `web/clinical-cases.json` as a workflow artifact.

This gives a reproducible path to refresh generated browser assets without hand-editing bundled code.

### HumMod export investigation

Added `docs/HUMMOD_EXPORT_DISCOVERY.md`.

Verified from the pinned upstream source:

- separate solution, display, and storage intervals exist in `Control/GoFor.DES`
- HumMod panels graph exact model symbols against `System.X`
- the verified mapped variables appear directly in display definitions
- no source-level CSV/JSON/export command was found in repository search

The units/semantics of `System.X` remain unverified and must not be inferred from menu labels.

No claim is made that the checked-in Windows executable exposes an undocumented exporter.
