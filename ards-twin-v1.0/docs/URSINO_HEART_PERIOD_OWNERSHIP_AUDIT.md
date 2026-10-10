# v1.5 SA-node / heart-period ownership audit

Status: shadow-comparator design complete; no ownership cutover
Date: 2026-10-10

## Question

Should the live simulation retain the current HumMod SA-node effector or eventually use the Ursino/Magosso heart-period equations downstream of the published autonomic controller?

## Source

Primary:
- Ursino M, Magosso E. Role of short-term cardiovascular regulation in heart period variability: a modeling study. Am J Physiol Heart Circ Physiol. 2003;284:H1479-H1493. DOI: 10.1152/ajpheart.00850.2002. PMID: 12595291.

Related source-family formulation:
- Ursino M. Interaction between carotid baroregulation and the pulsating heart: a mathematical model. Am J Physiol Heart Circ Physiol. 1998;275:H1733-H1747. DOI: 10.1152/ajpheart.1998.275.5.H1733.
- Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia. I. A mathematical model. Am J Physiol Heart Circ Physiol. 2000;279:H149-H165. DOI: 10.1152/ajpheart.2000.279.1.H149.

## Published structure

The Ursino/Magosso family represents heart period as the sum of a basal term plus separate sympathetic and vagal contributions. The sympathetic branch is delayed and nonlinear; the vagal branch is faster. The 2003 paper treats heart-period variability as the combined result of these distinct autonomic pathways and respiratory/lung-stretch interactions.

The project will not infer missing gains or time constants from the current HumMod SA-node response.

## Comparator design

Both candidate effectors will receive the same shadow autonomic inputs:

- cardiac sympathetic firing `f_sh`;
- cardiac vagal firing `f_v`;
- identical patient time;
- identical gas, pressure, and Vent state.

Candidate A:
- existing HumMod SA-node path.

Candidate B:
- exact published Ursino/Magosso heart-period path once its full parameter table and delays are transcribed.

Outputs for comparison:
- candidate heart period;
- candidate HR;
- response latency;
- peak change;
- recovery;
- behavior during severe hypoxia/CNS failure;
- stability under changing VT;
- performance under isolated hypercapnia after the 2001 CO2 controller is complete.

## Activation rule

No effector will be chosen because it produces a desired tachycardia. Ownership requires better agreement with the source validation experiments and native/reference perturbation suite.

## Current blocker

The structural equations are verified, but this repository does not yet contain a line-by-line primary-source transcription of every heart-period gain, time constant, delay, and threshold required for exact implementation. Candidate B therefore remains an audit target rather than active code.
