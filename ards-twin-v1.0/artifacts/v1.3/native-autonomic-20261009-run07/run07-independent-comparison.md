# Run07 independent native / source / shipped bundle comparison

Partial native export: 157 clock samples, 5156 variables, 14 timer arrays with 158 values against 157 clock samples. Full numeric arrays retained, mismatched arrays explicitly unassigned. No physiological/model files changed.

Native challenge baseline at 9.999996 sec: HR 71.679144747865/min. Endpoint 148.999440 sec absolute, 138.999444 sec elapsed: HR 0, CO 0, CaO2 0.033533600089 mL/mL, convective DO2 0 mL/min. First sampled HR0 at 147.999444 sec absolute; not a proven causal transition time.

146 genuine elapsed-time matched pairs (duplicate native baseline clocks retained); nearest 1-second samples, residual <1ms, no extrapolation or final-vs-peak relabeling. Reduced and bundle initialized clocks are 1 sec and native baseline is ~10 sec. Native challenge is already set at baseline; reduced/bundle mechanically defer intervention until next breath. This is shared FiO2 .20 / RR4 / VT .10L, not identical full-model conditions.

Source and shipped bundle are NOT equivalent: at elapsed180 source HR 72.046235221392, bundle HR 112.217041926667. Bundle lacks exposed convective DO2, CaO2, chemoreceptor, brain PO2/function diagnostics; these remain null. Both default snapshots lack Hct/Hgb/brain-flow diagnostics; source capacity is its fixed .201mL/mL boundary, unlike native exported Hct/Hgb/capacity. Bundle was executed in Node VM, not browser UI. Do not use reduced-source output as browser output.

Native has PaCO2 40.652077180277 / pH 7.419926601269 at endpoint while reduced/bundle develop hypercapnia/acidemia; the shared settings do not guarantee an equivalent challenge path. Native CO0 but nonzero brain flow/PO2/SA-node rate is retained without repair. No first causal divergence claim.

Verification: JS executions/assertions and Python parsing/formula/alignment/count/HEAD assertions passed. Parent owns manifest/status/postprocess; those files untouched. Native completion beyond this export remains blocked by reported advance144 autopsy failure undefined RightHeartInfarction.Area%.
