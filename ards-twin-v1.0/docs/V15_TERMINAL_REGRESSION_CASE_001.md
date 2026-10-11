# Formal Physician Regression Case: Combined Hypoxia + Hypoventilation

Case ID: `v15-terminal-001`
Captured: 2026-10-11
Status: **failed physician validation / preserved regression case**
Physiology authority: none

## Source artifact

Google Drive `vent` folder:
- file: `v15-hypercarbic-hypoxic-20261011-181010.zip`
- Drive file ID: `1-9uD9jqGXnUhH1Nrscr45OgDlFI7-JBI`
- SHA-256: `dd14a3cd02f57767583df929ae9303666fba11034b684945048f21a85c4f47c4`

Model metadata explicitly states:
- downloaded v1.5 physician evaluation build;
- live reduced HumMod browser model;
- **not native HumMod**.

## Ventilator insult recorded in exported session

The exported session records two setting changes:
- t=318 s: FiO2 0.60 -> 0.20; RR 20 -> 4/min; VT 420 -> 473 mL.
- t=439 s: VT 473 -> 300 mL.

Final severe settings:
- VC-AC
- FiO2 0.20
- PEEP 8 cmH2O
- RR 4/min
- VT 300 mL
- inspiratory flow 0.70 L/s
- inspiratory pause 0.20 s

These exported timestamps are the canonical machine record for this artifact. Any visually remembered intervention time should be treated as display/window context rather than replacing the raw event log.

## Terminal failure point

First trend sample with displayed HR=0:
- t=1450 s
- PaO2 38.47 mmHg
- PaCO2 197.09 mmHg
- arterial pH 6.7274
- MAP 16.54 mmHg
- displayed HR 0/min
- source SA-node HR 72.05/min
- published-model shadow HR 111.50/min
- brain tissue PO2 5.53 mmHg
- BrainInsult-PO2 effect 0
- HumMod sympathetic firing 1.5 Hz
- HumMod vagal firing 2 Hz
- Ursino cardiac sympathetic f_sh 60 spikes/s
- Ursino cardiac vagal f_v 5.41 spikes/s
- global convective DO2 13.95 mL O2/min
- oxygen-debt surrogate 2748.41 mL O2

At the final sample (t=1570 s), the gas/hemodynamic state remains frozen at the same terminal values while:
- displayed HR=0;
- CO=0;
- SV=0;
- source SA-node rate remains 72.05/min;
- Ursino shadow HR remains about 111/min.

## Why this case fails

The current simulator:
1. reaches mechanical pump failure;
2. forces displayed perfusing HR/CO/SV to zero;
3. leaves upstream electrical/autonomic rate outputs nonzero;
4. does not classify the state as a source-derived PEA rhythm;
5. does not model subsequent electrophysiologic deterioration to asystole;
6. stops evolving the terminal physiology.

Therefore this case is a **mechanical-arrest implementation**, not a complete terminal-rhythm simulation.

## Regression purpose

Future builds must replay this exact source artifact and demonstrate that terminal behavior is no longer represented by an unexplained zero-HR freeze.

The regression is not required to hit a hand-authored HR, PEA time, or asystole time.

Required future assertions are mechanistic:
- electrical and mechanical cardiac states remain separately visible;
- severe hypoxia/hypercapnia/acidemia can depress myocardial mechanics despite autonomic activation;
- mechanical standstill does not automatically erase electrical rate;
- PEA is derived only when organized electrical activation persists without effective forward flow;
- asystole occurs only if the electrophysiologic model ceases ventricular activation;
- terminal state continues evolving after loss of forward flow;
- all transitions have source provenance.

## Related design

See `hummod-vent-core/docs/TERMINAL_PHYSIOLOGY_ROADMAP.md`.
