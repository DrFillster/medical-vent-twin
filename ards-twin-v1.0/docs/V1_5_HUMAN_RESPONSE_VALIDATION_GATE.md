# Human cardiovascular response validation: protocol compatibility gate

Date: 2026-10-12
Authority: candidate-not-canonical
Status: evidence targets verified; direct quantitative match NOT ASSESSED.

## Executed numerical gates

Narrow workflow: v1.5 Candidate Smoke
Run ID: 38193016501
Tested SHA: 8c92866820b6364ef8a8f79d44bba7ca3f5f11a0
Conclusion: SUCCESS.

Passed:
- promotion parity;
- four gas perturbation cases;
- gas-stress recovery toward baseline and 4/2/1-ms coupling convergence;
- Ursino Fig. 9 sensitivity ordering;
- Ursino source-reproduction regression guard.

Caution: recovery gate checks movement toward baseline, not complete recovery of all variables; convergence gate checks a specified relative tolerance and ordering, not formal error bounds or physiologic validity. Source-reproduction guard does not establish quantitative Fig. 9 agreement.

## Independent human target studies

1. Halliwill JR, Morgan BJ, Charkoudian N. J Physiol. 2003.
DOI: 10.1113/jphysiol.2003.050708.
Isocapnic hypoxia, SaO2 ~85%, HR 61.9 +/- 1.8 to 74.7 +/- 2.7 /min, MAP 97.4 +/- 2.0 to 103.9 +/- 3.3 mmHg.
Matched hyperpnea control did not reproduce the HR/pressure change.
https://pmc.ncbi.nlm.nih.gov/articles/PMC2343329/

2. Houssiere A et al. Am J Physiol Heart Circ Physiol. 2005.
DOI: 10.1152/ajpheart.01043.2004.
Three-minute isocapnic hypoxia, SaO2 97% to 84%, HR 64 +/- 3 to 83 +/- 3 /min, MAP 83 +/- 2 to 86 +/- 3 mmHg (not significant); end-tidal CO2 held near 38 mmHg.
https://journals.physiology.org/doi/full/10.1152/ajpheart.01043.2004

3. Simmons GH, Manson JM, Halliwill JR. J Physiol. 2007.
DOI: 10.1113/jphysiol.2007.137216.
Mild hyperoxic hypercapnia with end-tidal PCO2 +5 mmHg, HR 59.3 +/- 2.7 to 62.4 +/- 2.8 /min; MAP 92.0 +/- 1.8 to 90.7 +/- 1.4 mmHg (not significant); matched hyperpnea raised HR similarly.
https://pmc.ncbi.nlm.nih.gov/articles/PMC2277196/

## Protocol compatibility / blockers

- Candidate inputs: PaO2, PaCO2, tidal volume, and systemic arterial pressure feedback.
- Halliwill and Houssiere report SaO2 targets, not matching PaO2 values. No arbitrary PaO2-to-SaO2 mapping is permitted. Need sourced oxygen dissociation / content with pH, temperature, PCO2, Hb, and relevant modifiers.
- Simmons reports end-tidal PCO2 rather than arterial PaCO2. Need a justified ETCO2-to-PaCO2 interface; do not silently set them equal.
- Studies involve awake healthy volunteers with intact ventilatory reflexes; the candidate currently uses fixed VT and gas forcing. Protocol-specific spontaneous hyperpnea, timing, and pulmonary stretch must be represented before quantitative equivalence claims.
- HR/MAP absolute baseline differences cannot be repaired by fitting new autonomic gains to published cohort means.
- Existing perturbation tests prove finite and distinct outputs, not agreement in sign, magnitude, timing, or recovery with human studies.

## Next executable challenge

1. Add source-compatible protocol metadata and produce HR/MAP/CO/SVR time series for candidate inputs without converting reported SaO2 or ETCO2 to PaO2/PaCO2.
2. Add sourced arterial oxygen content / hemoglobin dissociation and ventilation/ETCO2 interfaces separately.
3. Compare matched protocols by HR and MAP direction, magnitude, timing, and recovery, documenting every mismatch.
4. Keep candidate non-canonical until independent validation is adequate. No compensating gains.
