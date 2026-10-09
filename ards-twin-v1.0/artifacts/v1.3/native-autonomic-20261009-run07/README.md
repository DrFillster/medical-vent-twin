# Native run07 — partial capture, blocked by native autopsy error

This is real native HumMod.EXE output under Wine on macOS, not a browser trace relabeled native. Browser/source checkout: 7ab9cd7818ba4705b71c4082040add0ceb57ac59 on v1.3. No model, physiological parameter/gain tuning, protected deployments or cron changes were made.

## Execution

Relaunched the original executable after checkpoint load failed to demonstrate live state restoration. Replayed run06 setup: native 10-second baseline, ventilator ON, rate4/min, tidal volume100mL, gas tank ON, O2 20%, N2 80%, CO2/CO/anesthetic0. Fresh native-fresh-challenge.SOLN confirmed the same baseline clock0.1666666 minutes and HR71.6791447478653 as run06.

Native Go > 1 Sec was verified against native-step001.SOLN. Used 250ms sleep between subsequent submitted advances; desktop/Wine overhead and checkpoint/recovery pauses add wall-clock time. Do not interpret this as 250ms start-to-start cadence. A tool timeout interrupted the driver; native-resume-checkpoint.SOLN verified114 completed advances, so resume began115 without repeating advances.

Native flat ECG at advance138: native-run07-collapse.SOLN clock2.4666574 minutes, HR0. Declined the autopsy/continue notice and independently verified advance139 succeeded. At attempt144 native stopped at Math Error: Reference to an unknown variable, Structure\\Diagnosis\\Autopsy\\Autopsy.DES, Autopsy.Calc, RightHeartInfarction.Area%, Undefined. Saved native-autopsy-error.png; did NOT fix or tune model.

## Artifact interpretation

Vent.SOLN is a byte-for-byte copy of native-step139.SOLN, the LAST SUCCESSFULLY SAVED native export: clock2.483324 minutes (148.99944 seconds), HR0,157 clock samples. It is NOT a final180-advance export and does not capture the live error state's latest time. Attempt144 is not counted as completed/exported. All earlier SOLNs are preserved separately, including exports from failed checkpoint restoration.

Requested npm native:run07:postprocess was actually run and exited1. First failed gate: native exporter revision does not match pinned HumMod revision. Native source revision was not freshly verified, so metadata revision is null rather than claiming unverified provenance. Independently,180 advances and passing prior terminal time153.365933 seconds are also unmet by Vent.SOLN. No gates were weakened.

Supplemental comparison artifacts, when present, are partial-capture analysis and do not imply official postprocessor success. Raw native timer histories may differ in length; their handling must be disclosed. No clinical validation or first causal divergence established.

The verified recovery, coordinate control, asynchronous save/readback, timeout/resume safeguards, and native autopsy failure are recorded in the hummod-vent-core skill, references/native-gui-recovery.md.
