A Patient-Specific Cardiopulmonary Digital Twin for Predicting Ventilator Response

Specific Aims and Progress — November 20, 2026

Purpose and scientific foundation

Patients respond differently to ventilator adjustment because of differences in lung mechanics, gas exchange, breathing effort, and cardiovascular function. Our objective is to predict these individual responses using routinely collected intensive care unit data.

We have developed an integrated, physiology-based digital twin: a computer model that represents how a patient breathes, exchanges oxygen and carbon dioxide, and interacts with a ventilator. The model combines a reduced HumMod-derived heart–lung framework with ventilator mechanics and published models of respiratory control, patient effort, and respiratory muscle strength. Our additional development connects these components and establishes patient-specific starting conditions from clinical measurements.

This research evaluates our integrated model and an LLM-assisted patient-specific fitting method. The large language model will assist with organizing clinical information and selecting model inputs within defined constraints; the physiological simulator will calculate the patient response. MIMIC, a database of deidentified ICU records, provides the clinical data for development and testing.

Central hypothesis: An integrated physiological model, fitted using information available before a ventilator change, will predict subsequent vital-sign changes and blood-gas measurements more accurately than simple comparison methods. We will determine whether a published respiratory-failure phenotype model improves patient-specific initialization and identifies groups with different predictive performance.

Aim 1 — Establish reliable patient-specific phenotypes

Question: Can routine electronic health record data establish clinical phenotypes whose measured physiological features can be reliably reproduced using a digital twin?

We will use the published first-24-hour, two-cluster method from Terry et al. (2025), “Identification of Acute Respiratory Failure Phenotypes With Electronic Health Record Data.” We will reproduce its inputs, preprocessing, and assignment procedure rather than create new groups.

Within each phenotype, we will fit individual twins using pre-change measurements and constrained physiological parameters. Phenotype membership will provide clinical context, not replace individual measurements. We will compare initialization with and without phenotype information to determine whether it improves agreement with observed physiology, stability under unchanged ventilator settings, and the proportion of patients successfully represented.

Deliverable: A reproducible phenotype-assignment and patient-fitting workflow, with qualification coverage—the proportion meeting predefined baseline criteria—and documented reasons for failure.

Aim 2 — Test prediction after a ventilator change

Question: Does the initialized twin predict the patient’s response better than simple alternatives?

After initialization, patient-specific parameters will remain fixed while the twin receives the recorded ventilator change. We will compare predicted oxygen, carbon dioxide, pH, heart rate, and blood pressure with subsequent clinical measurements, reporting performance separately for each endpoint.

Comparators will include persistence, which predicts no change from the starting measurement, and a prespecified data-based prediction method. A paired simulation with unchanged ventilator settings will distinguish the modeled intervention response from baseline drift.

The fitting method, prediction timing, comparators, and scoring rules will be fixed before evaluation in a patient-disjoint test cohort: patients separate from those used in development and earlier evaluations.

Deliverable: Prediction accuracy, improvement over comparators, and failure rates, reported alongside qualification coverage.

Aim 3 — Determine whether performance differs across published respiratory-failure phenotypes

Question: Does the twin work consistently across established patient groups?

Using the same two published phenotype labels, we will compare qualification coverage and prediction accuracy between groups. This analysis will identify whether the model represents one group more successfully or produces systematic errors within a group. Phenotype assessment will be completed before the ventilator transitions being tested.

Deliverable: Phenotype-specific performance estimates, with explicit data requirements, eligibility criteria, and uncertainty.

Work completed to date

Integrated model and reproducible workflow. We connected the respiratory and cardiopulmonary components, implemented patient-specific fitting, and added automated checks for parameter bounds, repeatability, simulation integrity, and application of ventilator settings. Research code, tests, and audit findings are published on the GitHub research branch.

Baseline feasibility before phenotyping. Initial fitting qualified five of 19 development cases before phenotype assignment. A bounded gas-exchange parameter search recovered five additional cases, producing ten qualified cases and nine retained failures. The search completed 140 candidate simulations without execution errors; the five recovered fits passed fresh two-hour confirmation runs without further adjustment. These results establish a non-phenotyped baseline against which Aim 1 will test improvement.

Readiness for intervention testing. We completed paired changed-setting and unchanged-settings simulations for ten qualified cases. The unchanged runs exactly reproduced their saved baseline endpoints, and separate checks verified application of the requested settings in all 20 runs. This establishes that the prediction workflow runs reproducibly and can separate an intervention response from baseline drift.

Cohort and phenotype preparation. We inventoried pre-change feature availability across all 19 cases and selected the published phenotype method. Patient-level linkage identified prior-cohort overlap in all ten qualified patients, retaining them as development cases.

Next milestone: Reproduce the published phenotype model, test whether existing phenotype information improves initialization, and establish a patient-disjoint cohort for the fixed prediction and evaluation workflow.
