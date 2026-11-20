# Terry supplement findings and milestone status

Source: Terry et al. 2025, DOI 10.1016/j.chstcc.2025.100163;
PMC12646598 Data and Methods Supplement, NIHMS2111190-supplement-1.docx.
Retrieved Europe PMC supplementaryFiles ZIP; verified OOXML structure and
inspected paragraph/table text, package contents and external relationships.
Supplement SHA256: a59a6126e22d9d395a855b8e81eef5b38e4ca12cd1a856b885a739d438ff795d.

## Answer on two groups

Supplement section 'K-means Optimal Cluster Number' (printed page 53):
NBClust favored three groups most frequently for day one and two groups for
day two; two was second most frequent for day one. Silhouette and instability
favored two; elbow and gap analyses were inconclusive. Authors selected two
partly for consistent group count across time windows. Thus two is the chosen
published method, not unanimous evidence for only two biological states.
We retain two as approved and test utility without inventing subgroups.

## Reproduction not yet complete

Supplement provides detailed cleaning, temporal aggregation, package names,
descriptive tables, missingness and diagnostics. No deployable serialized
classifier or numeric pooled-center/scaler artifact identified in the retrieved
bundle. Tables of cluster medians are not K-means centers. Main figure plots
centers, but graphical estimates cannot reproduce exact assignments.
Targeted public searches did not locate a linked author model repository.
Need authors' final feature order, numeric pooled centers, training transforms,
scaling parameters, Amelia settings/bounds, assignment implementation and label
mapping. Absence in inspected materials does not establish nonexistence.

## Leakage question newly identified

Supplement uses encounter-level median height/weight and encounter-level
outlier statistics for some predictors. Strict pre-transition evaluation must
establish whether these were restricted to data available at the prediction
cutoff. Using future encounter measurements would leak information. Obtain
clarification before labeling extraction a faithful prospective reproduction.
Time summaries use paired twelve-hour time-weighted summaries, not a simple
24-hour mean or the last pre-transition measurement.

## Local timing audit

All 19 development cases retained: nine transitions occur before the first
24 hours have elapsed from earliest InvasiveVent status in that ICU stay;
ten occur at or after completion. This is a provisional status-derived anchor,
not confirmed intubation/first invasive chart timestamp or hospital-level
eligibility. Earlier ventilation and total encounter ventilation remain to audit.
No phenotype labels assigned and no outcome values read.

## Milestone disposition

Reproduction specification and timing feasibility advanced; exact assignment
blocked by missing verified author model artifacts. Initialization improvement
and phenotype-specific performance are not yet estimable. Independent test
cohort needs historical-use exclusion and complete temporal/source eligibility.
Production and integrated physiology unchanged.
