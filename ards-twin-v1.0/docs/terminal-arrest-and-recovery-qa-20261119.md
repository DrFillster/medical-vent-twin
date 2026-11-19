# Deployed HumMod: terminal arrest and pre-arrest recovery QA

Synthetic engineering check, 2026-11-19. Not patient data, clinical validation, or ventilator guidance.

## Provenance

- The live site source marker reported `bb9836196a0c9c61f15ddb86077af553ae45e582`.
- The downloaded engine and worker matched the GitHub blob IDs `3e06924e9f1de29de03d4264bb199dedc005f46f` and `2e665e67d9c64bdf8e65bd4d4a1017e1e5aa8bef` at that source, respectively. The engine blob at the checked v1.5 tip also matched.
- Executed the worker and bundle together in an isolated Node VM, not the workstation DOM. No reset, custom physiology parameters, or patient data were used between deterioration and restoration.

## Terminal arrest

The separate profound-asphyxia replay reached latched arrest by t=810 s. The worker accepted and applied the original settings and advanced to t=870 s. Arrest remained latched, HR and CO remained zero, and PaO2 and PaCO2 did not change. The patient clock continued; that does not indicate restored circulation. The branch extends the existing coupled-session test to cover the same terminal-state contract.

## Pre-arrest recovery versus matched no-change control

Both replays used the synthetic moderate-aspiration reference, VC-AC FiO2 0.60 / PEEP 8 / RR 20 / VT 0.42 L / flow 0.70 L/s / pause 0.20 s, default mechanical warmup, recruitment input (1, 0.35, 0), dt 0.002 s, and the source-aligned baro-chemoreflex mode. Both used 10-second worker advances. The rescue replay changed only FiO2 to 0.21, PEEP to 2, and RR to 4 from t=0 until the restoration request at t=230 s. The control never changed settings.

| Matched checkpoint | Rescue PaO2 | Control PaO2 | Rescue PaCO2 | Control PaCO2 | Rescue / control CO (L/min) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Initialization | 88.42 | 88.42 | 40.81 | 40.81 | 5.58 / 5.58 |
| Restoration requested, t=230 s | 21.23 | 45.08 | 68.37 | 39.10 | 5.58 / 4.90 |
| 10 min after request, t=830 s | 48.20 | 47.25 | 39.90 | 37.72 | 5.28 / 5.30 |
| 15 min after request, t=1130 s | 47.48 | 47.37 | 38.14 | 37.57 | 5.31 / 5.33 |

At t=1130 s rescue/control MAP was 91.31/91.40 mmHg and HR 121.50/123.41 per min. The recovered run approached the matched baseline despite not regaining the optimistic startup readings. Residual oxygen debt was still falling: 162.3 mL at t=250 s and 60.7 mL at t=1430 s. This is a measured synthetic trajectory, not evidence that all rescue scenarios recover.

The unchanged run’s ventilated-perfusion fraction was already 0.55 at startup and stayed near 0.55; membrane permeability was fixed. Mixed venous saturation fell from 0.779 at initialization to 0.549 at t=230 s. The source initializes the gas pool from source initial state and defaults to zero configured coupled equilibration (the initialization method still takes a one-second minimum step). The result is consistent with gas/circulatory transients under the configured shunt, not loss of recruitment from restoration. This does not establish the quantitative contribution of each subsystem.

Using the existing 240-second coupled warmup in an isolated repeat removed most of the visible oxygen transient (PaO2 45.27 to 46.23 from 10 to 120 displayed seconds), but exposed the same low settled oxygenation. Warmup alone is not a calibration fix. No production, UI, protocol, or model parameters were changed.
