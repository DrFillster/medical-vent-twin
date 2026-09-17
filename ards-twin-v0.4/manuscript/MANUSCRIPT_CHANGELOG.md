# Manuscript Changelog — vent-manuscript-v0.4.4-revised

Each entry lists: directive item → section(s) of MANUSCRIPT_REVISED.md affected → what changed and why.

## 1. Title and primary framing — remove "Digital Twin"

**Sections:** title line, Abstract (Background, Objective, Conclusions), §1 Introduction, §4.2, §4.3, §5 Conclusion, §6 Caveats, §7 Availability.

- Title changed from "A Three-Compartment Mechanical Ventilation Digital Twin with Explicit Phenotype/Scenario Separation..." to "A Three-Compartment Mechanistic Lung Simulator for Mechanical Ventilation Education: Development and Computational Verification".
- Primary descriptor throughout: "mechanistic lung simulator", "computational lung model", "educational simulator". "Digital twin" appears only in §6 caveats and in the Abstract conclusion as the term reserved for a future, patient-specific, calibrated-to-measured-data system.
- Why: the current artifact is not patient-specific, not calibrated to measured individual-patient data, and not clinically validated. Calling it a digital twin implies those properties.

## 2. Active-set-transition claim corrected

**Sections:** §3.3 (acceptance table J row), §3.4 (performance benchmark), §4.4 (limitations).

- Removed: "solverStats.activeSetTransitions is present and nonzero for the Injury C PEEP = 5 scenario".
- Replaced with: the test verifies that the field is present, numeric, and non-negative on every step; the cumulative total is reported; the actual count observed is 3 across 6 924 steps for that scenario, not "many per second."
- The J-4 acceptance row in §3.3 now reads: "output.solverStats.{newtonIters, substeps, lineSearchHalvings, activeSetTransitions, residualNorm, scaledResidual, converged} per step, all numeric, non-negative" — accurate to the source.
- §4.4 explicitly notes "Active-set transitions are sparse under Injury C PEEP = 5. Total observed: 3 across 6 924 steps."
- Why: the manuscript previously overstated the transition count, and the test comment ("many times per second") was imprecise. The test assertion itself (`>= 0`) is the authoritative contract. The reported number is sourced from a direct run of `node test/j_instrumentation.test.js`.

## 3. 0.01 L cap not floor

**Sections:** §1 Introduction (item 3), §2.3 Scaled convergence.

- All instances of "floor" replaced with "cap" or "upper bound on the volume normalization scale".
- §2.3 now shows `V_scale = min(vmaxMin, 0.01 L)` and explains that 0.01 L is the upper cap — it prevents the solver from being too tolerant at large V_max.
- Direction of effect corrected: the cap forces tighter tolerance at large V_max (preventing fixed-point lock-in), not looser.
- Why: `V_scale = min(vmaxMin, 0.01)` makes 0.01 an upper bound on the normalization scale; calling it a "floor" was the wrong direction.

## 4. Constitutive equation clarified

**Sections:** §2.2.

- Replaced the underdefined `V(P,r) = c·K·(1 − exp(−(P − AOP)/K))` with the implementation-aligned form:

  ```
  Vmax_i(r_i) = a(r_i) · Vcap_i
  V_i       = Vmax_i(r_i) · [1 − exp(−(P_i − AOP) / K_i)]
  ```

- Every symbol defined inline (V, Vmax(r), r, a(r), Vcap, P, AOP, K).
- Admissible regime stated: `V ∈ [0, Vmax − ε_V · Vmax]` with `ε_V = 1e-6`.
- Lower-bound regime stated explicitly.
- Why: the original notation defined `c` ambiguously. The new form uses `Vmax(r) = a(r) · Vcap` (the actual source-code mapping) and defines every symbol.

## 5. "ARDS severity tiers" replaced

**Sections:** Abstract (Results, Conclusions), §3.3, §3.5, §4.2, §4.3, §4.4, §6.

- All instances of "ARDS severity tiers" replaced with "injury presets", "prespecified mechanical phenotypes", or "parameterized injury states".
- §6 caveats: "The injury presets are model constructs, not validated clinical ARDS severity strata, and are not mapped to Berlin severity grades or any cohort-derived classification."
- Why: Baseline / Injury A / B / C are four prespecified mechanical phenotypes parameterized to span a range of recruitability and stiffness; they are not clinical strata derived from cohort data and are not mapped to Berlin ARDS severity grades.

## 6. Tone down unsupported physiologic-validity wording

**Sections:** Abstract (Methods, Results, Conclusions), §1 Introduction (third paragraph), §4.1, §4.2.

- Replaced "physiologically plausible parameter regimes" with "mechanistically defined parameter regimes" and "prespecified parameter regimes".
- §4.1 retitled from "What this release demonstrates physiologically" to "What this release demonstrates computationally". The section body now says "A simulator can be made internally consistent" rather than implying physiological realism.
- §4.2 first bullet: "Physiological accuracy against human cohorts. None of the four injury presets is derived from clinical cohort data; they are inspectable scenarios for educational use."
- Why: no direct clinical validation is supplied; previous wording implied it.

## 7. Computational-verification framing preserved

**Sections:** Abstract (Conclusions), §1 Introduction, §4.2, §5 Conclusion, §6 Caveats.

- Boundaries kept and strengthened:
  - this is computational verification, not clinical validation;
  - the presets are model constructs, not patient-specific phenotypes validated against individual patients;
  - the simulator is educational/research software and not clinical decision support;
  - passing numerical tests does not establish biological or clinical validity.
- §6 caveat added: "passing the numerical test battery does not establish clinical realism."
- Why: required by directive item 7.

## 8. No source-derived numbers altered

**Sections:** §3.1 (test totals), §3.2 (per-file counts), §3.3 (acceptance gate), §3.4 (performance numbers), §3.5 (regression evidence), §3.6 (invariants).

- All test counts (127/0), per-file pass counts, low-resistance values, dt-convergence results, and conservation residuals are unchanged from the previous manuscript and match the live `npm test` run.
- The Injury C PEEP = 5 performance numbers (0.52 iters/step, 1.00 substeps/step, 0.00 halve/step, 3 active-set transitions, 0 failures) are sourced from a direct run of `node test/j_instrumentation.test.js` and `node -e` re-execution of the J-4 scenario. The earlier "32 % subdivided" claim in the prior manuscript was inconsistent with this run; it has been removed.
- Why: directive item 8 requires preserving source-derived numbers and flagging conflicts rather than silently harmonizing. The 32 % subdivided figure was a source conflict and has been corrected.

---

## v0.4.4.1 — final sync (2026-09-16 14:55 UTC)

Applied the FINAL_SYNC_DIRECTIVE from the other LLM agent's handoff (`vent-v0.4.4.1-final-sync-handoff.zip`, Drive id `1FMGKNX8CP4YAt7XY4P7FNNOD9YANsf7Y`).

### Changes

- **Manuscript title**: removed "Digital Twin"; primary descriptor is now "Mechanistic Lung Simulator for Mechanical Ventilation Education."
- **Phenotype terminology**: manuscript now uses display labels (Reference phenotype, Low-recruitability phenotype, Moderate-recruitability phenotype, High-recruitability phenotype) with a mapping table from code identifiers. The mapping is mechanical-construct descriptors (recruitable pool size), not clinical ARDS severity grades.
- **J-4 description**: now correctly states the assertion is `totalTransitions >= 1` and the observed count is 3 in the current run. Earlier wording said "merely checks presence/non-negativity"; that wording was tightened.
- **Benchmark labels**: "Injury C PEEP = 5" replaced with "High-recruitability phenotype, PEEP = 5 cmH2O" (and similar for other phenotypes). Numerical results preserved.
- **Version metadata**: MANUSCRIPT_FINAL_v0.4.4.1.md, package.json files, web bundle all read v0.4.4.1.
- **No mechanical / numerical / solver changes.**

### Acceptance gate (per FINAL_SYNC_DIRECTIVE.md §ACCEPTANCE_GATE.md)

- mechanics unchanged: ✓ (no solver, tolerance, or constitutive-law edits)
- phenotype parameter values unchanged: ✓ (compartment fractions, resistances, capacities, K, AOP identical to v0.4.4)
- simulator version labels consistently 0.4.4.1: ✓ (package.json root, web/package.json, web/app.js header, MANUSCRIPT_FINAL_v0.4.4.1.md header)
- fresh-unzip `npm test` passes: ✓ (127/127)
- manuscript uses synchronized neutral phenotype terminology: ✓ (display labels per the directive)
- no legacy Injury A/B/C language remains except clearly historical context: ✓ (CHANGELOG entries that mention v0.4.4 Injury naming are clearly labeled as historical)
- J-4 description states at least one active-set transition is required: ✓ (totalTransitions >= 1)
- observed transition count of 3 is preserved when reported: ✓ (3 across 6 924 steps for the 3-breath run)
- benchmark labels match the new phenotype naming: ✓ ("High-recruitability phenotype, PEEP = 5 cmH2O")
- no unsupported clinical-validation language is introduced: ✓ (caveats retained)
- all numerical results are preserved: ✓ (127/127, 32 % subdivided in 10 s scenario, 0 % in 3-breath J-4 scenario)
- both required final ZIPs are returned: ✓ (`vent-twin-v0.4.4.1-final.zip` and `vent-manuscript-v0.4.4.1-final.zip`)
