# Manuscript Review Notes — vent-manuscript-v0.4.4-revised

This document identifies remaining unsupported or internally inconsistent claims in the manuscript that could not be safely corrected from the source material alone. It is part of the `vent-manuscript-v0.4.4-revised.zip` deliverable.

## A. Items the source could not resolve — flagged for owner

### A.1 J-4 test comment vs assertion mismatch

`test/j_instrumentation.test.js` line 97–99 says:

> "The Injury C PEEP=5 scenario is known to cross closure boundaries many times per second. We require at least one active-set transition somewhere in the run, demonstrating the counter is wired up."

But the actual assertion (line 115) is:

```javascript
assert(totalTransitions >= 0, 'active-set counter is wired');
```

`totalTransitions` is always `>= 0` because it is a sum of non-negative numbers. So the assertion does not require "at least one transition" — it would pass even if there were zero transitions. The actual run reports 3 transitions; the test would still pass with 0.

The narrative comment is imprecise; the assertion is the authoritative contract. The manuscript now describes the test as "verifies the field is present, numeric, and non-negative on every step; cumulative total is reported; the actual count is 3." This is accurate to the source.

**Not fixed in code because:** the directive scope is manuscript-only. Tightening the test from `>= 0` to a nonzero requirement (e.g., `>= 1` or `>= some_scenario_specific_floor`) is a behavioral change that affects the v0.4.4 acceptance battery. It requires an explicit authorization and a discussion of which scenarios should require which counts.

**Recommended next step:** either (a) tighten J-4 to assert `totalTransitions > 0` for the Injury C PEEP = 5 scenario (the actual current behavior already passes that), or (b) leave the test as-is and clarify the comment to match the assertion. Either choice is a software-side change.

### A.2 Preset naming and Berlin-ARDS mapping

The four presets are named "Baseline", "Injury A", "Injury B", "Injury C". The manuscript now states they are not mapped to Berlin ARDS severity grades. However, the names themselves ("Injury A/B/C") still imply a graded injury progression. If the owner wants a stricter separation from clinical-validity implications, the presets could be renamed to mechanical-construct labels (e.g., "Compartment set 1/2/3/4" or "phenotype A/B/C/D" with no "Injury" framing). This is a code-side rename affecting `src/presets.js` and the test files that reference the names.

**Not fixed in code because:** the directive scope is manuscript-only, and renaming presets would invalidate the published test counts unless the rename is applied in lockstep across `src/presets.js`, the test files, the JSON artifacts, and the manuscript. That is a multi-file change requiring explicit owner direction.

**Recommended next step:** confirm with the owner whether to (a) keep the current names and rely on the manuscript caveats, (b) rename presets to mechanical-construct labels, or (c) introduce a separate `presets.js` indirection layer that maps clinical-flavored names to internal mechanical identifiers.

### A.3 The "future digital twin" claim

The manuscript concludes with "digital twin terminology is reserved for future, patient-specific, calibrated-to-measured-data systems and does not apply to the current artifact." This is a forward-looking statement about a system that does not exist yet. It is not a validation claim about the current artifact, but reviewers may read it as scope creep.

**Not fixed because:** the directive allows "digital twin" usage only as a future-development concept with an explicit caveat, and the manuscript follows that rule. The owner may prefer to remove the forward-looking statement entirely if reviewer feedback is expected to flag it.

**Recommended next step:** if the owner wants the manuscript to make zero forward-looking statements, remove the final sentence of the Abstract and the §6 caveat that mentions "future digital twin" framing.

### A.4 The 32% subdivided claim that was wrong

The previous manuscript stated the Injury C PEEP = 5 scenario at dt = 1 ms had ~32 % of steps subdivision-bounded. The live run reports 1.00 mean substeps/step, which corresponds to 0 % subdivision (each step solved in exactly one subdivision). This is a real source conflict.

**Why it was wrong:** the previous claim appears to have come from a different performance benchmark (`PERFORMANCE_BENCH.json` line item "percent_steps_subdivided: 32") that used a different scenario configuration (different PEEP, different controller settings, or different initial recruitment state) than the J-4 test. The two scenarios are not the same; the previous manuscript conflated them.

**Corrected by:** removing the 32 % figure from the manuscript and reporting the J-4 numbers directly. The performance benchmark artifact still carries the 32 % figure for a different scenario; this is documented in §3.4 as "the J-4 scenario exactly" to avoid the conflation.

**Not fixed in the artifact trail because:** `PERFORMANCE_BENCH.json` carries source-derived numbers that the directive says must be preserved. The 32 % figure in `PERFORMANCE_BENCH.json` is for a different scenario than J-4. If the owner wants the artifact to drop the 32 % figure or annotate it as "non-J-4 scenario," that is an artifact-side change.

**Recommended next step:** either (a) leave `PERFORMANCE_BENCH.json` unchanged and ensure the manuscript does not conflate it with J-4 (now done), or (b) annotate the 32 % figure in `PERFORMANCE_BENCH.json` with the scenario that produced it.

### A.5 The "many transitions per second" comment in J-4

See A.1 above. The comment and the assertion disagree. The current observed rate is 3 transitions per 6 924 steps, which is roughly 0.43 transitions per second at 1 ms dt — not "many times per second." The comment is the source of the overstated claim in the previous manuscript.

**Not fixed in code because:** scope is manuscript-only.

**Recommended next step:** same as A.1.

## B. Items reviewed and confirmed clean

### B.1 Test totals

`npm test` returns `TOTAL: 127 passed, 0 failed` across 21 test files. The per-file counts in §3.2 were generated from the live `node test/runner.js` output (timestamped `2026-09-16T18:18Z`) and stored in `TEST_RESULTS.json` summary. The §3.3 acceptance gate is consistent with `TEST_RESULTS.json` and with `NUMERICAL_DIAGNOSTICS.json:test_counts.v0.4.4_total = 127`.

### B.2 Constitutive-law symbols

All symbols in §2.2 (`V`, `Vmax(r)`, `r`, `a(r)`, `Vcap`, `P`, `AOP`, `K`) are defined inline. The mapping `Vmax(r) = a(r) · Vcap` matches the source code in `src/compartments.js` and `src/contracts.js`. The admissible regime and lower-bound regime are described accurately per source.

### B.3 Direction-aware feasibility

The classification logic in §2.4 matches `src/mechanics.js:classifyBoundaryFeasibility` exactly. The I6 negative-flow and I7 positive-flow tests verify both branches. The constants `EPS_CAP = 1e-6` and `ε` for the feasibility bound are documented.

### B.4 Numerical examples in §3.4

The Injury C PEEP = 5 numbers (0.52 iters/step, 1.00 substeps/step, 0.00 halve/step, 3 active-set transitions, 0 failures) are sourced from a direct execution of `node test/j_instrumentation.test.js` and a re-execution of the J-4 scenario. They match `PERFORMANCE_BENCH.json` for the same scenario (where reported).

### B.5 References

The five references (§9) are the same as the previous manuscript; none are new. None claim clinical validation of the artifact. Reference 5 (Amato et al. 2015) is cited as a context reference for driving pressure and ARDS outcomes, not as a validation claim.

## C. Acceptance gate status

All items in `ACCEPTANCE_GATE.md` from the correction-handoff package:

| Item | Status |
|------|--------|
| 1. Title no longer calls the artifact a digital twin | ✓ |
| 2. No primary framing implies patient-specific digital-twin status | ✓ |
| 3. Active-set-transition wording matches the actual test and reported table | ✓ |
| 4. 0.01 L is described as cap/upper bound, not floor | ✓ |
| 5. Constitutive equation is explicit with every symbol defined | ✓ |
| 6. Injury A/B/C not described as validated ARDS severity tiers | ✓ |
| 7. No unsupported physiologic-validation language | ✓ |
| 8. Computational verification clearly distinguished from clinical validation | ✓ |
| 9. No source-derived numerical result silently changed (the 32% subdivided figure was a source conflict and was removed rather than silently harmonized) | ✓ |
| 10. No new citation, cohort claim, or validation claim invented | ✓ |
| 11. Return ZIP contains the three required manuscript files | ✓ (this ZIP) |

## D. Open question for the owner

The owner asked the assistant to apply the corrections, then said "the simulator also needs correcting." The assistant interpreted this as a follow-up scope question and asked which scope applies. The owner did not respond within the 10-minute clarification window. The assistant proceeded with manuscript-only corrections per the directive.

If the owner wants simulator-side changes too (e.g., tightening J-4 to require nonzero transitions, renaming presets, or annotating `PERFORMANCE_BENCH.json` with the scenario that produced the 32 % figure), the items in §A above are the recommended scope.

---

# v0.4.4.1 review notes addendum

## Items remaining open after v0.4.4.1 final sync

None. The FINAL_SYNC_DIRECTIVE acceptance gate has all 12 items green. See MANUSCRIPT_CHANGELOG.md "v0.4.4.1 — final sync" entry for the full checklist.

## Items previously flagged that are now closed

All OQ-1 through OQ-5 items are closed (see OPEN_QUESTIONS.md in the prior revised ZIP, or the prior session log). The OQ-2 preset rename was applied in v0.4.4.1. The J-4 comment fix (OQ-5) and assertion tightening (OQ-1) are part of v0.4.4.1.

## Items out of scope for v0.4.4.1

- Active-set / boundary formulation (reserved for v0.5).
- `initializationHistory` recovery (reserved for v0.5).
- Mapping of mechanical-construct phenotypes to Berlin ARDS severity grades (out of scope by design — the phenotypes are mechanical constructs, not clinical strata).
- Browser rendering quality evaluation.
- Patient-specific calibration.
- Educational efficacy studies.
- Expert face validity.

These are tracked as scope items, not as defects.
