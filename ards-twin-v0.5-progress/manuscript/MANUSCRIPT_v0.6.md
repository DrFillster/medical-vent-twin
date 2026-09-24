# A Browser-Based Persistent ARDS Clinical Twin for Interactive Mechanical-Ventilation Education

**ARDS Clinical Twin v0.6 — software development and computational verification report — not peer reviewed**

**Scope:** Educational/research simulation; synthetic patient; not clinically validated; not for patient care.

Author, affiliation, correspondence, ORCID, funding, conflicts, and contribution statements require completion before journal submission.

## Abstract

**Background:** Mechanical ventilation in acute respiratory distress syndrome (ARDS) requires integration of ventilator settings, respiratory mechanics, gas exchange, recruitability, and cardiovascular consequences. Educational simulators commonly demonstrate isolated mechanics or reset state between experiments, limiting longitudinal exploration.

**Objective:** To develop a browser-deployable persistent ARDS clinical-twin environment in which a synthetic patient's state persists while the learner changes ventilator settings, advances simulated time, performs respiratory-mechanics maneuvers, and observes synchronized responses.

**Methods:** Version 0.6 couples the Vent three-compartment mechanical lung model to a reduced, source-aligned HumMod-derived cardiopulmonary model. Recruitment and ventilatory history persist across interventions. Controls include ventilation mode, tidal volume or inspiratory pressure, respiratory rate, inspiratory flow/time, PEEP, FiO2, and inspiratory pause. Outputs include pressure/flow/volume waveforms, plateau pressure, total and intrinsic PEEP, driving pressure, PaO2, PaCO2, pH, mixed venous oxygenation, heart rate, mean arterial pressure, cardiac output, stroke volume, systemic vascular resistance, and pulmonary vascular resistance. Hypercapnic-acidemia hemodynamics were implemented as a separate control pathway from the baroreflex and bounded to published experimental challenge data rather than tuned by visual plausibility. Oxygen extraction was constrained by a critical venous/capillary PO2 transition so inadequate delivery produces supply-limited aerobic oxygen use rather than negative venous oxygen. The resulting oxygen-supply deficit is integrated over time as oxygen debt; accumulated debt progressively depresses myocardial contractility, and sustained profound hypotension can transition the virtual patient to a terminal cardiac-arrest state using explicit experimental cardiovascular-collapse criteria. Inspiratory/expiratory holds, intervention logging, synchronized trends, and session export are implemented. A separate research workbench supports externally produced HumMod trajectories and investigation of a pinned native HumMod runtime. No patient or learner data were used.

**Results:** The product supports a persistent reference aspiration-ARDS teaching phenotype that can undergo sequential ventilator changes without resetting the simulated patient. Ventilator interventions and passive-mechanics maneuvers share the same timeline and recruitment state. The reduced cardiopulmonary layer produces synchronized gas-exchange and hemodynamic outputs. Regression challenges require hypercapnic acidemia to increase heart rate and pulmonary vascular load while reducing systemic vascular resistance, require severe oxygen-delivery limitation to reduce modeled aerobic oxygen use before mixed venous oxygen becomes non-physical, and require persistent oxygen deficit to accumulate oxygen debt, depress myocardial contractility, progress through decompensated shock, and meet explicit terminal cardiovascular-collapse criteria under sustained profound hypotension. Separately, native-HumMod engineering work demonstrated successful execution of the pinned upstream executable and export of a 5,156-variable solution trajectory. The native runtime is not required by the deployed browser product and is not represented as clinically validated ARDS physiology.

**Conclusions:** Version 0.6 extends a browser mechanical-lung simulator into a persistent interactive cardiopulmonary teaching environment. Its principal contribution is integration of longitudinal lung state, ventilator manipulation, respiratory mechanics, gas exchange, systemic physiology, and intervention-linked trends in a static browser deployment. Computational verification supports software consistency, not clinical validity. The simulator is not a treatment recommender or patient-specific digital twin.

**Keywords:** ARDS; mechanical ventilation; simulation; digital twin; respiratory mechanics; recruitability; HumMod; medical education

## 1. Introduction

ARDS is a heterogeneous syndrome of acute hypoxemic respiratory failure rather than a single mechanical phenotype. The Berlin definition formalized timing, imaging, origin-of-edema, PEEP, and PaO2/FiO2 criteria and stratified oxygenation severity [1,2]. The newer Global Definition broadens the framework to include high-flow nasal oxygen, pulse-oximetry-based criteria, lung ultrasound, and modifications for resource-variable settings [3]. This simulator focuses on the intubated positive-pressure-ventilation domain and uses Berlin-style oxygenation terminology where appropriate; it does not claim to reproduce every element of either clinical definition.

Lung-protective ventilation is foundational to ARDS management. The ARDS Network trial demonstrated improved outcomes with a lower-tidal-volume strategy compared with traditional tidal volumes [4]. Subsequent work emphasized that tidal volume alone does not capture the full mechanical problem: plateau pressure, driving pressure, stress/strain, recruitability, and the interaction between PEEP and the individual lung are important physiologic concepts [5-8].

Recruitability is particularly useful educationally because oxygenation severity and mechanical response to PEEP are not interchangeable. Recruitment-to-inflation (R/I) methods estimate the balance between recruited volume and inflation of already open lung when PEEP changes [9]. Clinical and imaging work demonstrates substantial heterogeneity in recruitment and PEEP response [7-10]. A teaching environment should therefore permit sequential interventions in the same simulated patient rather than treating each setting as an unrelated snapshot.

LUNG SAFE demonstrated that ARDS is common in intensive care, frequently underrecognized, and managed heterogeneously [11]. This supports an educational rationale for accessible simulation but does not establish the effectiveness of this simulator.

Earlier Vent releases provided an inspectable three-compartment mechanical model and browser interface. Version 0.6 changes the product concept: the primary experience is a persistent synthetic ARDS patient whose mechanical and cardiopulmonary state evolves on a shared timeline.

## 2. System design

### 2.1 Architecture

The deployed application is static browser software. Vent owns detailed respiratory mechanics, breath timing, recruitment state, holds, and pressure/flow/volume waveforms. A reduced, source-aligned HumMod-derived cardiopulmonary layer supplies systemic and gas-exchange state. Both advance on one patient timeline.

No production server, native HumMod executable, clinical data feed, or patient record is required. A separate research pathway can ingest canonical HumMod trajectories produced outside the browser and supports continued experiments with a pinned upstream HumMod runtime. The reduced browser model and native HumMod executable are related engineering artifacts, not equivalent implementations.

### 2.2 Persistent state

After initialization, ventilator changes do not create a new patient. Recruitment history, mechanical state, elapsed time, intervention history, and systemic state remain associated with the session. Changes are applied at controlled breath boundaries, allowing pre/post intervention physiology to be compared on a common timeline.

The primary reference case is a synthetic aspiration-ARDS teaching phenotype. It is not a deidentified clinical record or patient-specific model.

### 2.3 Ventilator controls and mechanics

The interface exposes ventilation mode, PEEP, FiO2, respiratory rate, tidal volume for volume control, inspiratory flow, inspiratory pause, and pressure/time controls where supported. These are simulation inputs, not treatment recommendations.

The mechanical engine represents normal, recruitable, and consolidated tissue compartments plus airway resistance and pressure-history-dependent recruitment. Inspiratory and expiratory holds are explicit maneuvers. Passive-mechanics measurement reports plateau pressure, total PEEP, intrinsic PEEP, and driving pressure when the simulated conditions support those measurements.

### 2.4 Gas exchange and systemic physiology

The live browser cardiopulmonary layer provides PaO2, PaCO2, pH, heart rate, mean arterial pressure, and cardiac output. Ventilator and recruitment changes feed the reduced physiology so pulmonary interventions can have synchronized gas-exchange and hemodynamic consequences.

The layer is source-aligned to selected HumMod structures but intentionally reduced. It is not full HumMod running in the browser.

### 2.5 Hypercapnic acidemia, vascular control, and oxygen extraction

The reduced hemodynamic controller separates baroreflex compensation from hypercapnic-acidemia effects. This distinction was introduced because a single sympathetic-control term can produce the wrong vascular direction during respiratory acidosis: catecholaminergic activation may increase heart rate while local/systemic vascular effects of hypercapnia and acidemia reduce systemic vascular resistance.

For the current reduced implementation, the hypercapnic-acidemia pathway is activated only when PaCO2 exceeds 45 mm Hg and arterial pH is below 7.35. The response is bounded between the normocapnic state and a severe experimental hypercapnic-acidosis anchor reported by Stengl et al. [16]. In that mechanically ventilated porcine experiment, arterial pH was reduced to approximately 7.10 and the hypercapnic-acidosis group demonstrated increased heart rate, increased pulmonary vascular resistance, and reduced systemic vascular resistance. The reduced browser controller uses the published baseline-to-challenge ratios for those variables as transparent calibration anchors. The hypercapnic-acidemia target is linearly interpolated over pH 7.35 to 7.10 and, once hypercapnic acidemia is present, is allowed to dominate an opposing baroreflex vasoconstrictor target so that the systemic vascular response does not reverse the experimentally observed direction. The relationship is bounded and is not extrapolated below pH 7.10. Hypoxemia and positive intrathoracic pressure remain separate contributors to pulmonary vascular load.

This implementation is deliberately not described as a direct HumMod equation or as a validated human dose-response model. HumMod provides the source-aligned architecture for gas, acid-base, circulatory, and autonomic coupling [12], but the reduced browser pathway supplements that architecture with an explicitly cited experimental calibration where a directly exportable HumMod relationship has not yet been verified. Respiratory and metabolic acidosis are not treated as interchangeable; the present browser calibration applies specifically to hypercapnic acidemia.

Systemic oxygen extraction follows a Fick-style mass balance. A prior implementation could mathematically demand more tissue oxygen than was available from arterial oxygen content and cardiac output, driving modeled venous oxygen toward a non-physical value. The revised model therefore calculates the maximum aerobic oxygen use compatible with a positive venous oxygen tension. A critical venous/capillary PO2 of 15 mm Hg was selected from the lower bound of the 15-20 mm Hg range described for critical capillary oxygen tension [17]. When requested tissue oxygen use exceeds that delivery-limited value, actual modeled aerobic oxygen use is reduced and the difference is recorded as an oxygen-supply deficit. This is a transition to supply-limited aerobic metabolism, not an imposed normal SvO2 floor. Mixed venous PO2 and saturation remain free to fall to pathologically low but positive values.

### 2.6 Progressive shock, oxygen debt, and cardiovascular collapse

A progressive decompensation layer was added because a circulation that remains numerically stable despite persistent failure of oxygen delivery is not physiologically credible. The input to this layer is the oxygen-supply deficit already calculated by the gas-exchange core: requested aerobic tissue oxygen use minus the maximum aerobic oxygen use supportable by arterial oxygen content and cardiac output. The deficit is integrated over time as oxygen debt in milliliters of O2. For scale-independent interpretation within a simulated patient, cumulative debt is divided by that patient's requested tissue oxygen use to yield "equivalent debt minutes," defined as the duration of complete unmet resting oxygen demand that would produce the same cumulative deficit. This quantity is an engineering state variable, not a validated clinical mortality score.

The controller distinguishes stable physiology, depleted compensatory reserve, active oxygen debt, decompensated shock, refractory shock, and cardiac arrest. A mixed venous oxygen saturation of 45% is used only as a low-SvO2 engineering warning marker. It lies within the published 30-50% range associated with critical oxygen delivery and depletion of extraction reserve, but it is not treated as a universal clinical decompensation threshold. The terminal transition remains determined by accumulated oxygen deficit and sustained profound hypotension rather than SvO2 alone [19]. Active oxygen-supply deficit defines oxygen debt even when arterial pressure remains preserved, because oxygen debt and its metabolic correlates may identify severe shock that is occult to conventional vital signs [19].

Accumulated oxygen debt feeds back on the circulation through progressive myocardial depression. The severe-shock lower bound for the myocardial contractility multiplier is calibrated to the ratio of ventricular elastance measured in an experimental hemorrhagic-shock/lactic-acidosis model (approximately 0.50 versus 2.87 mmHg/uL) [20]. The present reduced model does not calculate serum lactate from oxygen debt and does not impose a deterministic pH-to-death relationship. These omissions are intentional: lactate generation and clearance are not uniquely determined by tissue hypoxia, and no validated human pH threshold defines irreversible cardiovascular failure.

The terminal cardiac-arrest state uses experimental cardiovascular-collapse definitions rather than an arbitrary mortality switch: mean arterial pressure below 30 mmHg for 10 minutes or below 20 mmHg for 10 seconds [21]. Once this criterion is met, the reduced browser core reports zero heart rate, stroke volume, and cardiac output and stops advancing the circulation, while retaining the final pre-arrest state for auditability. These thresholds originated in experimental hemorrhagic shock and are used as transparent simulation endpoints, not as patient-specific prognostic thresholds.

A 35-minute equivalent-debt scale is used to normalize the progression of the myocardial-injury signal, anchored to the mean time to cardiovascular collapse reported during fixed-rate porcine hemorrhage (35 +/- 11 minutes) [18]. The calibration is deliberately bounded and is not interpreted as a universal human survival time. Importantly, oxygen debt is cumulative in the present implementation. Published shock physiology indicates that true resuscitation requires repayment of debt, generally through oxygen consumption above the pre-shock requirement, rather than merely restoring baseline delivery [19,22]. Because the current reduced gas core does not yet model post-shock VO2 overshoot or microcirculatory no-reflow, debt repayment is not synthesized by an arbitrary decay constant; this remains an explicit next-stage physiology task.

### 2.7 Trends and reproducibility

Pressure, flow, and volume waveforms are displayed alongside physiologic trends. Intervention markers identify when ventilator changes occurred. Session export preserves synthetic simulation state for inspection and reproducibility.

## 3. Native HumMod research pathway

HumMod is an integrative human-physiology modeling environment [12]. The research workbench pins a specific upstream standalone revision. Engineering work established that the native executable can be launched and advanced and can export a solution containing 5,156 variables, including time series for arterial oxygen and carbon-dioxide pressures, arterial pH, heart rate, systemic arterial pressure, and cardiac output.

This demonstrates access to genuine upstream HumMod output. It does **not** demonstrate that default HumMod physiology is ARDS, that the reduced browser model is numerically identical to full HumMod, or that either is clinically validated for ventilator management.

Native calibration therefore remains a separate research track. Candidate pulmonary-injury parameters must demonstrate reproducible sensitivity and then be calibrated against defensible ARDS targets before trajectories can be represented as native-HumMod ARDS phenotypes.

## 4. Scientific basis

Berlin oxygenation severity does not directly specify recruitability, compliance, dead space, shunt fraction, chest-wall mechanics, or hemodynamic response [1,2]. The simulator therefore does not derive recruitability from an oxygenation label.

The ARDS Network lower-tidal-volume trial established outcome benefit from a lung-protective strategy [4]. Driving pressure has subsequently been associated with survival and is useful as a teaching concept [5]. The simulator exposes these relationships but does not turn them into bedside recommendations.

PEEP may recruit collapsed lung, distend already open lung, and affect pulmonary vascular and systemic hemodynamics; the balance varies among patients [6-10]. The R/I ratio provides a bedside estimate of recruitment relative to inflation during a PEEP change [9], but recruitability assessment has important methodological limitations [10]. The simulator therefore exposes mechanisms and heterogeneity rather than labeling a particular PEEP as optimal.

Web-based simulation can make ventilation training accessible without a dedicated physical simulator. Published work comparing web-based and on-site lung-simulator education supports the feasibility of the medium while underscoring that educational effectiveness must be measured rather than assumed [13]. Version 0.6 has not undergone a prospective learner-outcomes study.

## 5. Computational verification

Verification addresses deterministic software behavior, not clinical validation. Unit and regression tests exercise mechanical equations, state transitions, ventilator-setting changes, respiratory holds, systemic-provider routing, trajectory contracts, and browser-product behavior.

A v0.6 product smoke test exercises live initialization, time advance, persistent PEEP change, and finite cardiopulmonary outputs. The build generates browser assets and case manifests from source; deployment verification checks the static-host contract. Browser smoke testing is available separately for Chromium and WebKit.

Passing these tests establishes behavior according to encoded contracts in tested scenarios. It does not establish prediction of an individual patient or justify clinical treatment.

## 6. Discussion

The principal v0.6 contribution is architectural integration: a persistent mechanical lung, ventilator controls, respiratory-mechanics maneuvers, gas exchange, systemic physiology, waveforms, longitudinal trends, and intervention logging in one browser-deployable synthetic patient.

Persistence permits an experiment: establish a state, intervene, advance time, and inspect the trajectory without silently resetting recruitment history.

The distinction between reduced browser physiology and native HumMod is scientifically important. Future work should compare the reduced model with reproducible native trajectories and determine which source parameters can generate defensible ARDS-like states. Only after calibration should such trajectories be promoted as native-HumMod ARDS phenotypes.

### Limitations

The reference patient is synthetic and parameters have not been estimated from an individual patient. The mechanical model simplifies regional structure, chest-wall mechanics, spontaneous effort, airway phenomena, and time-dependent processes. The cardiopulmonary layer simplifies ventilation-perfusion heterogeneity, metabolism, neurohumoral control, and organ interactions. The hypercapnic-acidemia vascular calibration currently relies on a severe, short-duration porcine experiment rather than a validated human ARDS dose-response curve; its purpose is to preserve documented response direction and approximate magnitude within a bounded challenge domain, not to predict an individual patient's hemodynamics. Human studies have not shown a uniform PVR increase with mild hypercapnia, so the pulmonary response should be regarded as context dependent. The oxygen-supply limitation uses a literature-derived critical capillary PO2 threshold and does not yet include explicit lactate kinetics, organ-specific extraction, or mitochondrial failure. The progressive shock layer is likewise a reduced engineering model: oxygen debt is computed directly from modeled aerobic supply deficit, myocardial depression is bounded to experimental animal data, and terminal arrest uses experimental profound-hypotension criteria. It is not a validated human mortality model. The current version intentionally does not assign a lactate concentration from oxygen debt, does not add a numeric vasoplegia coefficient without a defensible calibration dataset, and does not yet model physiologic oxygen-debt repayment, post-shock VO2 overshoot, microcirculatory no-reflow, organ-specific ischemic injury, malignant arrhythmia, or neurologic death.

The simulator has not been validated against prospective patient trajectories, physical ventilator/test-lung experiments across its full domain, expert-performance benchmarks, or learner outcomes. Numerical plausibility and software agreement are not substitutes for those forms of validation.

The terms **clinical twin** and **virtual patient** describe persistent simulation architecture. They do not imply a patient-specific digital twin, regulatory qualification, diagnostic capability, or treatment recommendation.

## 7. Future work

Priorities are: reproducible native-HumMod load-modify-advance-export experiments; direct extraction and verification of HumMod acid-base, chemoreflex, vascular, and oxygen-use relationships; replacement of empirical reduced-model anchors when source-native relationships are reproducibly available; human validation of hypercapnic and metabolic-acidosis response domains; explicit lactate/anaerobic-metabolism modeling; source-anchored terminal vasoplegia and organ-specific ischemic injury; physiologic oxygen-debt repayment with post-shock VO2 overshoot and microcirculatory recovery/no-reflow; native pulmonary-injury sensitivity analysis; calibration against prespecified ARDS oxygenation, mechanics, and hemodynamic targets; comparison of native trajectories with the reduced browser core; expansion to multiple severity/recruitability phenotypes after calibration; external mathematical and critical-care review; and prospective usability and educational-outcome evaluation.

## 8. Conclusions

ARDS Clinical Twin v0.6 transforms Vent from a browser mechanics laboratory into a persistent synthetic-patient environment for mechanical-ventilation education and research. It permits sequential ventilator interventions, mechanics maneuvers, and synchronized mechanical, gas-exchange, and hemodynamic observation without resetting the patient.

The software is computationally testable and inspectable. Those properties support reproducibility but do not establish clinical validity. The release is for education and research, not patient care.

## Declarations

**Ethics and data:** No patient data, recruited participants, or learner observations were used in this software-development report.

**AI assistance:** Software development, review, and manuscript drafting used generative-AI assistance. Human authors must verify the material, describe contributions according to the target journal's policy, and take responsibility for submission.

**Funding:** Add details here.

**Conflicts of interest:** Add details here.

**Author contributions:** Add details here.

**Availability:** Insert final public-release URL, archival identifier, software license, and release commit before submission.

## References

1. ARDS Definition Task Force, Ranieri VM, Rubenfeld GD, et al. Acute respiratory distress syndrome: the Berlin Definition. *JAMA*. 2012;307:2526-2533. doi:10.1001/jama.2012.5669.
2. Ferguson ND, Fan E, Camporota L, et al. The Berlin definition of ARDS: an expanded rationale, justification, and supplementary material. *Intensive Care Med*. 2012;38:1573-1582. doi:10.1007/s00134-012-2682-1.
3. Matthay MA, Arabi Y, Arroliga AC, et al. A New Global Definition of Acute Respiratory Distress Syndrome. *Am J Respir Crit Care Med*. 2024;209:37-47. doi:10.1164/rccm.202303-0558WS.
4. Acute Respiratory Distress Syndrome Network. Ventilation with lower tidal volumes as compared with traditional tidal volumes for acute lung injury and ARDS. *N Engl J Med*. 2000;342:1301-1308. doi:10.1056/NEJM200005043421801.
5. Amato MBP, Meade MO, Slutsky AS, et al. Driving pressure and survival in ARDS. *N Engl J Med*. 2015;372:747-755. doi:10.1056/NEJMsa1410639.
6. Briel M, Meade M, Mercat A, et al. Higher vs lower PEEP in acute lung injury and ARDS: systematic review and meta-analysis. *JAMA*. 2010;303:865-873. doi:10.1001/jama.2010.218.
7. Goligher EC, Kavanagh BP, Rubenfeld GD, et al. Oxygenation response to PEEP predicts mortality in ARDS. *Am J Respir Crit Care Med*. 2014;190:70-76. doi:10.1164/rccm.201404-0688OC.
8. Gattinoni L, Caironi P, Cressoni M, et al. Lung recruitment in patients with ARDS. *N Engl J Med*. 2006;354:1775-1786. doi:10.1056/NEJMoa052052.
9. Chen L, Del Sorbo L, Grieco DL, et al. Potential for lung recruitment estimated by the recruitment-to-inflation ratio in ARDS: a clinical trial. *Am J Respir Crit Care Med*. 2020;201:178-187. doi:10.1164/rccm.201902-0334OC.
10. Giovanazzi S, et al. Assessment of recruitment from CT to the bedside: challenges and future directions. *Crit Care*. 2025.
11. Bellani G, Laffey JG, Pham T, et al. Epidemiology, patterns of care, and mortality for patients with ARDS in ICUs in 50 countries. *JAMA*. 2016;315:788-800. doi:10.1001/jama.2016.0291.
12. Hester RL, Brown AJ, Husband L, et al. HumMod: a modeling environment for the simulation of integrative human physiology. *Front Physiol*. 2011;2:12. doi:10.3389/fphys.2011.00012.
13. Safadi S, Acho M, Maximous SI, et al. Comparison of web-based and on-site lung simulators for education in mechanical ventilation. *Respir Care*. 2024;69:1353-1360. doi:10.4187/respcare.12072.
14. Gattinoni L, Pesenti A. The concept of "baby lung." *Intensive Care Med*. 2005;31:776-784. doi:10.1007/s00134-005-2627-z.
15. Slutsky AS, Ranieri VM. Ventilator-induced lung injury. *N Engl J Med*. 2013;369:2126-2136. doi:10.1056/NEJMra1208707.
16. Stengl M, Ledvinova L, Chvojka J, et al. Effects of clinically relevant acute hypercapnic and metabolic acidosis on the cardiovascular system: an experimental porcine study. *Crit Care*. 2013;17:R303. doi:10.1186/cc13173.
17. Kisaka T, Stringer WW, Koike A, Agostoni P, Wasserman K. Mechanisms That Modulate Peripheral Oxygen Delivery during Exercise in Heart Failure. *Ann Am Thorac Soc*. 2017;14(Suppl 1):S40-S47. doi:10.1513/AnnalsATS.201611-889FR.
18. Navarro LH, Lima RM, Khan M, et al. Continuous measurement of cerebral oxygen saturation (rSO2) for assessment of cardiovascular status during hemorrhagic shock in a swine model. *J Trauma Acute Care Surg*. 2012;73(2 Suppl 1):S140-S146. doi:10.1097/TA.0b013e3182606372.
19. Rixen D, Siegel JH. Bench-to-bedside review: oxygen debt and its metabolic correlates as quantifiers of the severity of hemorrhagic and post-traumatic shock. *Crit Care*. 2005;9:441-453. doi:10.1186/cc3526.
20. Kimmoun A, Ducrocq N, Sennoun N, et al. Efficient extra- and intracellular alkalinization improves cardiovascular functions in severe lactic acidosis induced by hemorrhagic shock. *Anesthesiology*. 2014;120:926-934. doi:10.1097/ALN.0000000000000077.
21. Gomez H, Mesquida J, Hermus L, et al. Physiologic responses to severe hemorrhagic shock and the genesis of cardiovascular collapse: can irreversibility be anticipated? *J Surg Res*. 2012;178:358-369. doi:10.1016/j.jss.2011.12.015.
22. Barbee RW, Reynolds PS, Ward KR. Assessing shock resuscitation strategies by oxygen debt repayment. *Shock*. 2010;33:113-122. doi:10.1097/SHK.0b013e3181b8569d.
