# Publication-Readiness Assessment — Mechanical Ventilation Digital Twin
**Reviewed:** `~/medical-vent-twin/index.html` (1,457 lines, single-file HTML5), git `01c9f13`, deployed at vent.defying-logic.com
**Date:** 2026-09-13
**Reviewer scope:** novelty vs literature, methodological soundness, venue fit, recommendation

---

## Verdict
**Not publication-ready as a research paper.** Publishable as a **technical / educational tool** in a knowledge-translation venue (ATS Scholar, BMC Med Educ, JMIR Med Educ, MedEdPORTAL, Breathe, Simulation in Healthcare, Respiratory Care), and only after the three blockers below are fixed and a small validation study (N≥20 trainees or bench-vs-ASL5000) is added.

---

## Novelty vs literature (verbatim survey of ~30 cited works)

| Component | Status | Anchor |
|---|---|---|
| Two-compartment RC (fast + slow) | **Derivative** — established | Similowski & Bates 1991 *Eur Respir J* 4:353; Victorino 2004 *JAP* 98:1202; Pulletz 2012 *Respir Res* 13:44 (EIT fast/slow); Gattinoni & Pesenti 2005 *ICM* 31:776 (baby lung) |
| Sigmoid PEEP-opening of slow compartment | **Derivative in concept**, novel in algebra | Closest: Karbing 2007 *J Crit Care* 22:126 (two-compartment V/Q); no published source found with `eff_shunt = true_shunt·(1−openness) + baby_lung_shunt·openness` written exactly this way |
| Iso-shunt diagram with `PaO₂ = P/F · FiO₂^0.6` | **Derivative** | Arieff 1978; Petros 1994 *BJA* 73:215; West/Feiner classic |
| Severinghaus ODC + Bohr/temp/2,3-DPG/COHb shifts | **Derivative** | Severinghaus 1979 *JAP* 46:599; Siggaard-Andersen 1984 *Clin Chem* 30:1646 |
| Mechanical power (Gattinoni formula) | **Derivative** | Gattinoni 2016 *ICM* 42:1567; Cressoni 2016 *Anesthesiology* 124:1100 (12 J/min threshold); Serpa Neto 2018 *ICM* 44:1914 (mortality); Schaefer 2020 *ICM* 46:2121 (formula comparison) |
| Decremental PEEP trial + automatic Pflex | **Derivative** | Hickling 2001 *AJRCCM* 163:69; the Pflex detection here is *not* the published algorithm — see weaknesses |
| Chen 2020 R/I ratio | **Derivative** | Chen 2020 *AJRCCM* 201:178; Cour 2022 *Crit Care* 26:85 (validation against ASL5000) |
| **Integration** of all six in one browser artifact | **Possibly novel** | No published single-file HTML5 tool combines decremental-PEEP/Pflex + Chen R/I + Gattinoni MP + Severinghaus ODC + iso-shunt + parallel-RC. Closest comparators: VentSim (Safadi 2024 *Respir Care* 69:1425), OPENPediatrics, xlung, Body Interact — none publish the combination |

**Bottom line:** Physiology is textbook. Two genuinely novel items — (i) the algebraic `eff_shunt` blend and (ii) the integration of all six components into a single-file artifact. Neither is a physiology finding; both are *knowledge-translation* contributions.

---

## Methodological soundness — what's right

- Parallel-compliance summation `Crs = C_fast·f_fast + C_slow·f_slow` is correctly applied; comment block explains why reciprocal sum is wrong (L466-470). Matches clinical Crs in ARDS.
- Severinghaus ODC implemented as `PaO₂/P50`-normalized lookup table (L608-635), which is the right design — shift-invariant and immune to sigmoid tuning errors. Trap-resistant.
- ARDSNet Vt enforcement snaps to `6 mL/kg PBW` (Devine) when on. Mode-specific recomputation is correct.
- Cost function uses hard penalties with magnitudes (50/100/500/2000/5000) that dominate the optimization base (MP in ~10–50 range). Correct ordering — safety cannot be traded for elegance.
- MP decomposition (Gattinoni) with resistive vs elastic split and MP/ΔP ratio (Costa 2023 framing) is internally consistent.
- Bohr shift `0.05 · (7.40 − pH) · 27 ≈ −1.35 mmHg per 0.10 pH` is the published convention; temperature shift `1.018^(ΔT)` is the textbook form.
- Gas exchange does not double-count recruitment (the eff_shunt logic is the *only* recruitment pathway for PaO₂). Good — the skill explicitly warns about this trap.

---

## Top 3 weaknesses (publication blockers)

### 1. Critical bug — decremental PEEP trial crashes
`peepTitration()` (L676-742) builds the curve as `points[]` (L686) but the Pflex detection block references `pts[]` (L706, L707, L711, L715, L719). `pts` is undefined in this scope. Clicking "Run Trial" in the running app throws `ReferenceError: pts is not defined` before R/I is computed. The advertised feature (Pflex + R/I from a decremental PEEP trial) is **non-functional in the deployed build**. Fix is one rename (`pts → points`, 5 lines) — but a referee will not believe the work is publication-grade until the bug is fixed and re-verified. **Blocker #1.**

### 2. Pflex detection threshold is unscaled (algorithmic defect, not just naming)
The "largest drop in Crs between consecutive PEEP steps" detector (L705-720) uses a hard-coded 20% threshold (`maxDrop > peakCrs · 0.20`). I replicated the loop in Python for all four presets at default settings:
- Mild ARDS (recruit=0.40): max drop = 4.2 mL/cmH₂O, peak = 38.7 → 4.2/38.7 = 10.9%. Threshold fails. Pflex defaults to PEEP=4.
- Moderate ARDS (recruit=0.60): max drop = 1.9 / peak = 26.7 = 7.1%. Threshold fails. Pflex = 4.
- Severe ARDS (recruit=0.50): max drop = 1.2 / peak = 13.2 = 9.1%. Threshold fails. Pflex = 4.

**Every preset returns Pflex = PEEP 4**, including the high-recruiter scenario that should detect a knee around PEEP 12-14. The threshold needs to be a *relative* comparison (e.g., drop / smooth-trend Crs, or curvature over 3 points) — not a fixed 20% of peak. Hickling 2001 used best-compliance, not a threshold; the Chen 2020 R/I ratio paper uses an integral. **Blocker #2.**

### 3. R/I integration produces inflated values
The decremental PEEP integral `dV = ∫ Crs dPEEP` (L728-734) integrates from PEEP 20 → 4 over a Crs curve that is **monotonically decreasing** as the slow compartment closes. Resulting R/I values run 0.41 (severe ARDS, low recruiter) to 1.12 (mild ARDS) — clinically implausible. Chen 2020 reports median R/I ≈ 0.5 for moderate ARDS, and low recruiters cluster at R/I < 0.2. The simulation produces R/I that does not separate recruiters well — a tool that says "everyone is a high recruiter" is not useful. The likely cause is that `dV` measures *total recruitment* but does not normalize against the *compliance change at the low- vs high-PEEP baseline* the way Chen's single-breath method does. **Blocker #3.**

### Secondary issues (not blockers, but referee material)
- Iso-shunt table (L568-572) is hard-coded to *P/F on FiO₂=1.0*. Real Shapiro/West curves are defined at multiple FiO₂; using FiO₂^0.6 with a FiO₂=1.0 anchor overestimates PaO₂ at low FiO₂ for high shunts. Petros 1994 is the standard correction. Current behavior probably matches what an ICU fellow *wants* to see, but a referee will flag it.
- Preset values (L406-440) are **hand-picked**, not fitted to a published cohort. Strong defensibility requires a citation for each preset's compliance / shunt / recruitability numbers — currently silent on provenance.
- No code documentation beyond inline comments; no test harness; no benchmark vs ASL5000. A model paper without an ASL5000 or retrospective-cohort comparison will be rejected from a clinical journal.
- Single-file delivery is a strength for deployment but a weakness for review — there is no versioned, citable code object beyond the HTML.

---

## Venue fit

**Realistic targets (after blockers fixed + small validation):**
- **ATS Scholar** (~3 IF, no APC, publishes simulation-based mastery learning) — best fit. Cf. Schroedl 2021 *ATS Scholar* 2:34.
- **BMC Medical Education** (~3.6, OA) — publishes interactive teaching tools.
- **JMIR Medical Education** (~3.5) — published Tulaimat 2016 review of web MV simulators; tool-validation is in scope.
- **MedEdPORTAL** — peer-reviewed teaching modules; the Loma-Otero 2018 neonatal MV module is a near-template.
- **Breathe** (ERS) — published NIV simulator 2021.
- **Simulation in Healthcare** — published Spadaro 2017 RCT of math-model MV training.
- **Respiratory Care** — published Safadi 2024 web-based simulator non-inferiority trial.

**Stretch targets (require real validation, not educational framing):**
- **J Appl Physiol** (~3) — accepts RC-model papers. Precedent: Similowski/Bates 1991.
- **J Crit Care** (~3) — accepts simulation/education + technology.
- **Critical Care** (BMC, ~19) — accepts physiology/modeling.
- **Intensive Care Medicine** / **Critical Care Medicine** — only if bench-vs-ASL5000 + cohort validation included. Hamlington 2025 *Crit Care Med* on digital twins is the bar.

**Wrong venues:**
- *Anesthesiology* / *AJRCCM* — would require prospective trial-grade validation the artifact does not have.

---

## Recommendation

**Major revision.** The integration is genuinely novel; the physiology is textbook-correct *except* in the R/I and Pflex paths; the deployed build has a fatal crash bug. Fix the three blockers above (rename `pts→points`, retune the Pflex detection to a curvature or best-compliance method, rebuild the R/I integral against the Chen 2020 single-breath derivation), then add a small validation study (N≥20 trainees pre/post, or bench comparison against the published Cour 2022 ASL5000 protocol), then target **ATS Scholar** or **BMC Medical Education** for the educational contribution. Do not submit to a clinical journal until validation data exists.

---

## Cited literature (full bibliography in subagent survey; 37 entries)

Highest-priority references to read before submitting:
- Chen 2020 *AJRCCM* 201:178 — R/I princeps study
- Cour 2022 *Crit Care* 26:85 — ASL5000 R/I accuracy benchmark
- Safadi 2024 *Respir Care* 69:1425 — web-based MV simulator validation
- Tulaimat 2016 *JMIR Med Educ* 2:e8 — comparative review of web MV simulators
- Similowski & Bates 1991 *Eur Respir J* 4:353 — two-compartment RC foundational
- Gattinoni 2016 *ICM* 42:1567 — mechanical power formula
- Cressoni 2016 *Anesthesiology* 124:1100 — 12 J/min VILI threshold
- Petros 1994 *BJA* 73:215 — iso-shunt correction for low FiO₂
- Hamlington 2025 *Crit Care Med* (digital twin APRV) — clinical benchmark
- Lai 2023 *Crit Care* 27:269 — systematic review of CPM for MV

---

## Files changed
None. Assessment only.