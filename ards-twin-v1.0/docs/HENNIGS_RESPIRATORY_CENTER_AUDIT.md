# Hennigs 2026 Respiratory-Center Audit and Vent Interface

Status: interface defined; equation activation blocked pending complete primary-source transcription
Date: 2026-10-10

## Primary source

Hennigs C, Bilda F, Selpien H, Lerg T, Männel G, Becher T, Schädler D, Rostalski P. Patient-ventilator interaction—Development of a mathematical model of the respiratory center. Comput Methods Programs Biomed. 2026;280:109329. DOI: 10.1016/j.cmpb.2026.109329. PMID: 41905158.

The paper explicitly integrates chemical feedback, mechanical feedback, and reflex mechanisms to simulate spontaneous breathing and patient-ventilator interaction.

## Architectural placement

The Hennigs model is the respiratory-neural controller between sensed physiology and Vent mechanics:

```
PaO2 / PaCO2 / respiratory chemical state
          +
mechanical / reflex feedback
          |
          v
respiratory-center state
          |
          v
patient effort / respiratory muscle drive
          |
          v
Vent mechanics
          |
          v
actual pressure / flow / VT
          |
          +--> lung-stretch feedback
          +--> gas exchange
```

Vent remains owner of airway mechanics and actual delivered pressure/flow/VT.

## Typed shadow interface

Required inputs:
- patient time;
- arterial O2 state;
- arterial CO2 state;
- current lung-volume/mechanical feedback quantities explicitly required by Hennigs;
- ventilator support state;
- any reflex-state inputs explicitly defined by the paper.

Required outputs:
- respiratory neural-drive state;
- spontaneous respiratory timing/rate state;
- patient-effort signal suitable for the Vent engine;
- diagnostic event flags for patient-ventilator interaction/asynchrony where explicitly defined.

## No-double-authority rule

Hennigs and the older Ursino ventilatory-control equations must not both independently own respiratory drive.

Before activation:
1. transcribe every Hennigs controller equation and parameter from the primary article/supplement;
2. map each Hennigs state to a unique project variable and unit;
3. determine which Ursino ventilation equations become reference-only;
4. reproduce the source hypoxia, hypercapnia, pressure-support, and asynchrony validation conditions;
5. run the Hennigs output in shadow mode against current Vent mechanics.

## Current status

The source identity and controller architecture are verified. A complete equation/parameter transcription has not yet been obtained from a canonical full-text representation in the current research environment. No physiologic gain, state transition, or patient-effort mapping will be guessed.
