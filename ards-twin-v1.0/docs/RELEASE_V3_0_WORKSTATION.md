# v3.0 ventilator workstation

Release date: 2026-11-09. Implements phase 1 of the approved Servo-i UI design (GitHub issue #17).

The browser release is v3.0; the unchanged physiology package retains its existing v1.5 source version. `browserAssetVersion` is `3.0.0-ui`. This is a presentation release, not a claim of device equivalence or new physiological qualification.

## Delivered

- Servo-i inspired workstation: mode/status bands, three aligned pressure/flow/volume traces, a right-hand measured-values column, persistent cardiopulmonary strip, four direct-access settings and modal settings/holds/trends/clock/research panels.
- Existing persistent reference patient and VC-AC engine, with unchanged equations, patient inputs, autonomic response, gas stores, timing, holds, exports and extremis scenario.
- Device-facing VT in mL and flow in L/min. The adapter converts once to existing L and L/s inputs; waveforms convert for display only. The volume trace remains labeled modeled lung volume, not inspired tidal volume.
- Measured RR and VTe use the last fully completed Vent breath, excluding the final partial-breath record. Expired minute ventilation is VTe × measured RR; no invented physiology or filtering. Pre-session warm-up breaths are labeled. Original exact measurement values remain available in Research; main pressure displays round to one decimal.
- Current settings remain separate from pending edits. Apply uses the existing next-completed-breath transition; Cancel restores active values. Existing hold invalidation remains unchanged.
- Explicit legacy passive scenario: no spontaneous effort; wakefulness and neuromuscular blockade are not modeled. PC is unavailable for this live patient. SIMV, PS/CPAP and APRV remain disabled pending source-backed effort/controller implementation and verification, as required by the approved phased design.
- Complete frozen v2.4 artifact at `/v2.4/`, including its own engine, workers, manifest, styles, native-client files and source marker. The default page links to it on both public hostnames.

## Validation boundaries

Browser regression covers the existing extremis HR/arrest trajectory, manual low-PEEP transition and current hold pairing, plus unit conversion, pending edits, cancellation, responsive panels, unavailable modes and archived-v2.4 startup.

No physiological qualification tolerance or gate changes. The five previously disclosed source-reproduction assertions remain unresolved; a UI release does not establish full physiological validation. New assisted ventilation is subsequent work under issue #17.
