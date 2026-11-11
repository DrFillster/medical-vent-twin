# MIMIC × HumMod Research Program

## Overall objective
Determine whether a mechanistic, HumMod-informed cardiopulmonary digital twin can reconstruct and predict clinically observed physiologic trajectories in mechanically ventilated adults using routinely collected ICU data.

## Central hypothesis
A mechanistic cardiopulmonary digital twin initialized from routinely collected ICU data can predict the direction and magnitude of physiologic responses to changes in mechanical ventilation better than static associations or simple empirical baselines.

## Initial study
Adult invasive ventilation; manually verified ventilator transitions; patient state initialized only from pre-intervention data; frozen forward simulation; comparison with measured post-transition physiology and prespecified simple baselines.

## Specific Aims
1. Determine whether routine ICU data are sufficient to initialize and identify a patient-specific cardiopulmonary digital twin.
2. Test whether the digital twin predicts the physiologic response to real ventilator changes.
3. Validate integrated cardiopulmonary responses rather than isolated respiratory predictions.
4. Develop patient-specific mechanistic phenotypes from parameters required to explain observed responses.
5. Evaluate counterfactual prediction under alternative ventilator strategies.
6. Determine whether high-resolution physiologic signals improve state estimation and prediction.
7. Determine when mechanistic modeling adds information beyond statistical and machine-learning models.

## Validation rules
- No future leakage.
- Trace every patient-specific parameter to an observed value, an estimate, a prior, or an explicit non-identifiability statement.
- Start with manually reviewed ventilator transitions.
- Freeze the patient state before post-intervention outcomes are used.
- Compare with persistence, population-average, and simple empirical baselines.
- Quantify uncertainty when parameters are weakly identified.
- Treat counterfactual simulations as research predictions, not treatment recommendations.
