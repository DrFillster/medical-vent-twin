# Terry 2025 reproduction gate — approved aims implementation

Authority: SPECIFIC_AIMS_2026-11-20.md is the user-approved aims text.
Sole classifier: Terry et al., CHEST Critical Care 2025;3(3):100163.
Primary source: https://pmc.ncbi.nlm.nih.gov/articles/PMC12646598/
Use 0–24-hour model only. No new clusters or alternate phenotype classifiers.
The two labels are a testable stratification, not two standardized patients.
Preserve within-cluster continuous measurements and individual physiological fits.

## Verified main-text implementation requirements

Adults receiving invasive ventilation for 48 hours through 30 days; first
invasive ventilator-specific timestamp defines initiation. Main text lists
candidate inputs, then removes variables with >50% missingness and collinearity.
The final retained input list must come from the supplement/model artifacts,
not be inferred from the candidate list or plotted outcome differences.
Twenty expectation-maximization/bootstrap imputations; K-means per imputation;
K-medoids pooling of centers; complete cases use pooled centers, incomplete
cases use modal assignment across imputations. Exact transformations, training
scaling parameters, retained feature order, centers, aggregation and imputation
implementation must be obtained before assignment. Never substitute medians or
refit K-means on our 19 cases and call it the published model.

## Temporal and eligibility gates

Transition must follow completion of the phenotype observation window.
Verify ventilation episode alignment, exact variable aggregation, timestamps,
unit mapping and eligibility. The 48-hour ventilation-duration inclusion is
retrospective eligibility, not information known at hour 24; label selection
as retrospective and report its effect on generalizability. MIMIC-IV use is
transport to a different database version, not an already completed replication.

## Test of adequacy

Compare phenotype-informed versus existing individual initialization under
one prespecified paired development design. Report all failures, agreement,
drift and between-/within-label residual patterns. Do not split labels after
seeing failures. If labels add no useful predictive information, report that
negative finding; expanding cluster count would require a separate approved
study, not modification of this reproduction.

## Current blocking facts

Main article verified. PMC supplement URL returns an HTML download challenge,
not a verified DOCX; alternate Europe PMC retrieval succeeded as a ZIP bundle. Supplement contents await inspection. Deployable
model components have not yet been verified. No cluster assignments made.
LLM assistance is proposed in aims; a fixed constrained input contract and
its independent checks must be implemented before claiming validated assistance.
