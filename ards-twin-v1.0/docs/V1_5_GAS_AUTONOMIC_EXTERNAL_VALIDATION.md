# v1.5 Gas-Autonomic External Validation Ledger

Date: 2026-10-11
Candidate: Ursino/Magosso gas-autonomic cardiovascular closed loop
Authority: **candidate-not-canonical**

## Validation rule

Human experimental data are validation targets, not calibration constants.

Do not:
- alter source equations to hit a volunteer result;
- add an HR, MAP, resistance, or Emax gain to improve agreement;
- treat SaO2 as PaO2;
- treat end-tidal CO2 as PaCO2;
- treat end-tidal O2 as PaO2;
- infer an arterial gas from a saturation or end-tidal target without a sourced gas-exchange / oxyhemoglobin mapping.

A mismatch must trigger source, protocol, coordinate, or model-structure review.

## Human isocapnic hypoxia

### Halliwill et al. 2003

Source:
John R Halliwill, Barbara J Morgan, Nisha Charkoudian.
Peripheral chemoreflex and baroreflex interactions in cardiovascular regulation in humans.
J Physiol. 2003;552:295-302.
DOI: 10.1113/jphysiol.2003.050708.

Protocol:
- healthy normotensive nonsmokers;
- acute isocapnic hypoxia;
- arterial oxygen saturation approximately 85%;
- matched isocapnic hyperpnoea control.

Reported:
- HR 61.9 +/- 1.8 -> 74.7 +/- 2.7 /min;
- MAP 97.4 +/- 2.0 -> 103.9 +/- 3.3 mmHg;
- sympathetic activity increased.

Candidate use:
- direction and approximate scale of hypoxic chronotropic/autonomic response;
- evidence that hyperpnoea alone should not reproduce the full hypoxic response.

Coordinate limitation:
- the stimulus is reported as arterial oxygen saturation, not a directly specified PaO2.

### Houssiere et al. 2005

Source:
Chemoreflex and metaboreflex control during static hypoxic exercise.
Am J Physiol Heart Circ Physiol. 2005;288:H1724-H1731.
DOI: 10.1152/ajpheart.01043.2004.

Hypoxia-alone reported:
- SaO2 approximately 97% -> 84%;
- HR 64 +/- 3 -> 83 +/- 3 /min;
- MAP 83 +/- 2 -> 86 +/- 3 mmHg;
- MSNA increased;
- PETCO2 maintained near baseline.

Candidate use:
- independent evidence for substantial hypoxic tachycardia and sympathetic activation without requiring a large MAP increase.

Coordinate limitation:
- SaO2 / end-tidal protocol; not a direct arterial PaO2 coordinate.

## Human hypercapnia

### Simmons et al. 2007

Source:
Grant H Simmons, Julie M Manson, John R Halliwill.
Mild central chemoreflex activation does not alter arterial baroreflex function in healthy humans.
J Physiol. 2007;583:1155-1163.
DOI: 10.1113/jphysiol.2007.137216.

Protocol:
- hyperoxic hypercapnia;
- end-tidal PCO2 +5 mmHg above eucapnia.

Reported:
- HR 59.3 +/- 2.7 -> 62.4 +/- 2.8 /min;
- MAP 92.0 +/- 1.8 -> 90.7 +/- 1.4 mmHg;
- no significant MSNA change;
- matched hyperpnoea produced a similar HR increase.

Candidate use:
- mild hypercapnia must not be treated as a universal strong sympathetic tachycardic stimulus;
- respiratory-mechanical effects matter.

Coordinate limitation:
- PETCO2 is not silently converted to PaCO2.

### Peripheral chemoreceptor contribution during hypercapnia

Source:
Peripheral chemoreceptor contributions to sympathetic and cardiovascular responses during hypercapnia.
PMID: 12564639.

Protocol:
- CO2 rebreathing;
- PETCO2 approximately 40 -> 58 mmHg;
- compared hypoxic (PETO2 50 mmHg) and hyperoxic (PETO2 200 mmHg) conditions.

Reported qualitative result:
- sympathetic activation occurred at a lower CO2 level during hypoxic hypercapnia than during hyperoxic hypercapnia.

Candidate use:
- combined O2/CO2 interaction must remain distinct from isolated CO2 response.

## Integrated model comparison

### Cheng et al. 2016

Source:
Cheng L, Albanese A, Ursino M, Chbat NW.
An integrated mathematical model of the human cardiopulmonary system: model validation under hypercapnia and hypoxia.
Am J Physiol Heart Circ Physiol. 2016;310:H922-H937.
DOI: 10.1152/ajpheart.00923.2014.

Published validation regimes include:
- hypercapnia at inspired CO2 levels 3-7%;
- hypoxia at inspired O2 levels 7-9%;
- isocapnic hypoxia;
- hypocapnic hypoxia.

Reported model-validation variables include:
- HR;
- arterial pressure;
- cardiac output;
- respiratory variables and alveolar gases.

Role:
- source-family integrated comparison;
- useful for cross-variable trajectory consistency;
- not ground truth and not a replacement for human data.

Coordinate limitation:
- its primary experiment coordinate includes inspired gases and a full gas-exchange/respiratory-control model. Our promoted candidate currently accepts arterial gases directly and therefore cannot be compared point-for-point until the selected canonical gas-exchange layer supplies those arterial trajectories.

## Candidate acceptance sequence

1. Confirm finite and distinct response to isolated hypoxia, isolated hypercapnia, and combined stress.
2. Confirm recovery after normalization.
3. Confirm numerical convergence of the controller/plant coupling.
4. Generate a PaO2/PaCO2 response matrix in the candidate's native arterial-gas coordinate.
5. Verify qualitative human distinctions:
   - hypoxia produces a stronger chronotropic/autonomic response than mild isolated hypercapnia;
   - mild hypercapnia does not create a large MAP/MSNA-like response;
   - combined hypoxic hypercapnia is not equivalent to isolated hypercapnia.
6. Defer exact volunteer point matching until a sourced coordinate mapping is present.
7. Later validate ICU/mechanically ventilated behavior separately; do not hard-code healthy-volunteer percentage changes.

## Current status

Steps 1-3: passed in candidate smoke validation.

Step 4-5: implementation checked in; execution pending.

Canonical authority remains blocked.
