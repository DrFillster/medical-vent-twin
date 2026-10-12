# Independent Human Gas-Autonomic Validation Gate

Status: candidate-not-canonical; external quantitative validation NOT PASSED.
Date: 2026-10-12

## Verified CI
- GitHub Actions run 38193016501; head 8c92866820b6364ef8a8f79d44bba7ca3f5f11a0; success.
- Promotion parity, gas perturbation, recovery/convergence, Fig. 9 sensitivity, and hemorrhage source-reproduction guards passed.
- These are software and source-family checks; none establishes quantitative human validity.

## Core comparison rule
The model input is **arterial PaO2 / PaCO2** and imposed tidal volume. The human studies often report **SaO2 / SpO2**, **end-tidal PCO2**, and actual respiratory pattern. Do not treat saturation as PaO2 or end-tidal CO2 as arterial PaCO2. Do not invent gas conversion, respiratory drive, or saturation curve. Label missing direct gas inputs explicitly.

## Primary human targets (not calibration values)

### Halliwill, Morgan, Charkoudian 2003
DOI 10.1113/jphysiol.2003.050708; PMID 12897165.
Acute isocapnic hypoxia (SaO2 approximately 85%), matched hyperpnoea control.
Reported HR 61.9 +/- 1.8 to 74.7 +/- 2.7 /min; MAP 97.4 +/- 2.0 to 103.9 +/- 3.3 mmHg.
Reference: https://pmc.ncbi.nlm.nih.gov/articles/PMC2343329/
Comparison: direction and context now; numeric match BLOCKED pending documented PaO2 input and exact time/ventilation profile.

### Houssiere et al. 2005
DOI 10.1152/ajpheart.01043.2004; PMID 15604123.
Healthy subjects, 3-minute isocapnic hypoxia intervention with end-tidal CO2 controlled.
Reference: https://pubmed.ncbi.nlm.nih.gov/15604123/
Comparison: protocol-dependent direction; exact PaO2/PaCO2/VT inputs and measurement timing require primary-paper extraction.

### Simmons, Manson, Halliwill 2007
DOI 10.1113/jphysiol.2007.137216; PMID 17640930.
Hyperoxic hypercapnia, end-tidal PCO2 approximately +5 mmHg.
Reported HR 59.3 +/- 2.7 to 62.4 +/- 2.8 /min; MAP 92.0 +/- 1.8 to 90.7 +/- 1.4 mmHg; no significant MSNA change.
Reference: https://pmc.ncbi.nlm.nih.gov/articles/PMC2277196/
Comparison: mild central hypercapnia must not be assumed to cause strong sympathetic tachycardia. Quantitative PaCO2 matching BLOCKED without documented arterial values and hyperoxic condition in model.

### Cheng et al. 2016
DOI 10.1152/ajpheart.00923.2014; PMID 26747507.
Integrated human cardiopulmonary model benchmark for hypercapnia and hypoxia.
Use as model-to-model reference, not independent patient ground truth.

## Next candidate audit

1. Export time-stamped candidate HR, MAP, CO, resistance, Emax, venous capacitance, and autonomic firing from baseline, isolated hypoxia, isolated mild hypercapnia, combined stress, and recovery.
2. Include imposed PaO2, PaCO2, VT, time, and all numerical-method metadata in each trace.
3. Keep **pulsatile instantaneous arterial pressure** separate from window-averaged MAP. Do not compare a phase sample with a human MAP.
4. Report measured baseline, stimulus response, and recovery without fitted gains.
5. Classify each human comparison as exact-protocol, approximate, directional-only, or not comparable; report missing variables.
6. Treat a discrepancy as a model limitation, not permission to tune an empirical HR gain.
7. No canonical bedside promotion on software test success alone.

## Physician interpretation
The promoted candidate has passed internal numerical and source-structure checks. It has not yet shown that it predicts real-world HR/MAP/CO trajectories under hypoxia or hypercapnia in a ventilated ARDS patient.
