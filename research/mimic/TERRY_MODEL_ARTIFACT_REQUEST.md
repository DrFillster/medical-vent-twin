# Author artifact request - prepared, not sent

Public corresponding author: Charles R. Terry; terrych@musc.edu (article).

We are evaluating an integrated cardiopulmonary digital twin using MIMIC-IV
and plan to apply only your published 0-24-hour respiratory-failure classifier,
without discovering new clusters or modifying your phenotype definitions.
We reviewed the article and Data and Methods Supplement.

Could you share the deployment artifacts or analysis code required to assign
new encounters to the original 0-24-hour clusters:

1. Final retained feature names and order after missingness/collinearity filtering.
2. Numeric pooled centroids, cluster-label mapping and any fitted model object.
3. Exact normalizing transformations and training scaling parameters; clarify
   whether MIMIC-III validation was scaled using MUSC or cohort-specific values.
4. Amelia configuration, feature bounds, seeds, training/imputation objects and
   the rule for incomplete new records, label alignment and tied modal votes.
5. Temporal aggregation code and carry-forward/boundary rules for both twelve-
   hour windows, including a variable with no first-window measurement.
6. Whether encounter-level median height/weight and outlier statistics used
   observations after 24 hours; if so, guidance for applying the original model
   strictly using data available at a later pre-intervention prediction cutoff.
7. Original encounter inclusion/ventilation aggregation SQL and any available
   test fixtures (nonpatient example inputs with expected assignments).

We will preserve the published two-group model and cite your work. We are not
requesting identifiable patient data. This request has not been sent.
