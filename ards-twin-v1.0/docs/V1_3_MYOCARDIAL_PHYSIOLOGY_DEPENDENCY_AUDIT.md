# v1.3 HumMod myocardial physiology dependency audit

## Objective

Define the smallest source-aligned myocardial subsystem boundary that can reproduce the native run06 collapse mechanism without substituting arterial pH or inventing reduced-model failure rules.

## Native terminal chain observed in run06

Observed order near terminal collapse:

1. myocardial lactate rises;
2. intracellular SID falls;
3. myocardial pH falls;
4. myocardial pH function effect falls;
5. total myocardial function falls;
6. left/right heart failure latches;
7. HumMod sets asystole from left-heart failure;
8. actual heart rate and cardiac output become zero while computed SANode-Rate.Rate remains nonzero.

The current sample spacing is too sparse to assign causality between all upstream terms. Run07 is designed to resolve that.

## Source dependency graph

### Myocardial function

`LeftHeart-Function.Effect` and `RightHeart-Function.Effect` multiply:

- local myocardial pH effect;
- protein effect;
- fuel effect;
- temperature effect;
- structural effect.

Failure is latched below 0.2 and clears only above 0.4.

### Local myocardial pH

`LeftHeart-Ph.Ph` and `RightHeart-Ph.Ph` are computed by `PhCells.Calc` from:

- local myocardial PCO2;
- local intracellular SID.

Intracellular SID includes local myocardial lactate.

Therefore arterial pH is not an acceptable direct substitute.

### Myocardial lactate

Local lactate mass changes from:

- anaerobic glucose use -> lactate production;
- lactate utilization;
- diffusion against the systemic lactate pool.

Anaerobic glucose use depends on myocardial anaerobic metabolic demand and glucose delivery.

### Myocardial metabolism

Myocardial oxygen need depends on:

- basal metabolism scaled to myocardial mass;
- thyroid effect;
- heat/metabolic effect;
- myocardial structural effect;
- ventricular work.

Oxygen lack is:

`O2Need - O2Use`

Anaerobic calories are derived from oxygen lack.

### Myocardial oxygen use and flow

Myocardial O2 use depends on a source-native implicit tissue-PO2 solution.

Myocardial blood flow depends on:

- pressure gradient;
- small- and large-vessel conductance;
- sympathetic alpha activity;
- tissue PO2;
- ADH;
- metabolic demand;
- viscosity;
- anesthesia;
- myocardial vascular structure/infarction state.

This means myocardial metabolism cannot be reproduced faithfully by attaching a simple arterial oxygen or MAP penalty to contractility.

### Local myocardial CO2

Local bicarbonate mass and PCO2 depend on:

- myocardial metabolic CO2 production from O2 use and respiratory quotient;
- myocardial blood flow;
- arterial bicarbonate;
- blood SID;
- tissue liquid volume;
- source tissue/blood gas-base conversion functions.

## Port boundary

A source-faithful myocardial failure port must eventually include, or receive as native state:

1. myocardial flow and tissue PO2;
2. myocardial O2 need/use/lack;
3. myocardial fuel selection and anaerobic glucose use;
4. myocardial lactate mass and exchange;
5. myocardial bicarbonate/CO2 mass;
6. intracellular SID and pH;
7. myocardial function effect and failure hysteresis;
8. asystole/rhythm coupling.

Porting only item 7 with arterial pH would reproduce the terminal switch but not HumMod physiology.

## Current implementation status

Implemented source-aligned:
- myocardial function curves;
- failure/recovery hysteresis;
- asystole relation;
- native trace roster for the upstream chain.

Not yet ported:
- myocardial flow implicit equation;
- myocardial metabolism;
- fuel selection;
- lactate mass balance;
- CO2/bicarbonate mass balance;
- PhCells/Tissue-BaseToGas/Blood-GasToBase dependencies.

## Decision rule

Do not integrate source-aligned myocardial failure into the reduced runtime using synthetic local pH.

First use run07 to determine the native trajectory and first divergence. Then port the upstream subsystem in dependency order and compare reduced versus native trajectories at each layer.

Clinical ARDS/extremis scenarios remain the downstream first-look evaluation after native HumMod fidelity is acceptable.
