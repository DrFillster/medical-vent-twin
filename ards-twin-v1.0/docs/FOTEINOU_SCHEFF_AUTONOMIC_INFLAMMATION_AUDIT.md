# Foteinou / Scheff Inflammation-Autonomic Audit

Status: source audit complete enough for architecture; no live coupling
Date: 2026-10-10

## Primary sources

- Foteinou PT, Calvano SE, Lowry SF, Androulakis IP. Multiscale model for the assessment of autonomic dysfunction in human endotoxemia. Physiol Genomics. 2010;42:5-19. DOI: 10.1152/physiolgenomics.00184.2009. PMID: 20233835.
- Scheff JD, Mavroudis PD, Calvano SE, Lowry SF, Androulakis IP. Modeling autonomic regulation of cardiac function and heart rate variability in human endotoxemia. Physiol Genomics. 2011;43:951-964. DOI: 10.1152/physiolgenomics.00040.2011. PMID: 21673075.

## Relevant source structure

Foteinou explicitly models inflammation-dependent autonomic dysfunction/HRV states. Published equations include a nonlinear proinflammatory modulation state, a filtered autonomic-stress state, and HRV turnover dynamics.

Scheff extends the inflammation-to-cardiac/autonomic framework and uses an integral pulse frequency modulation approach to generate beat timing from autonomic modulation.

## Project placement

These models are not substitutes for the normal Ursino/HumMod autonomic controller.

Intended layering:

```
validated normal autonomic controller
          |
inflammatory state / neuroendocrine state
          |
autonomic sensitivity / coupling modifier
          |
cardiac timing / HRV shadow diagnostics
```

## What may be implemented next

Only after Yamanaka sepsis state validation:
- inflammation/autonomic-coupling shadow state;
- HRV/cardiac-timing shadow output;
- comparison against the source endotoxemia experiments.

## What is not permitted

- no generic “sepsis tachycardia” gain;
- no HRV reduction term without the source state equations and parameters;
- no use of endotoxemia parameters as a normal-physiology controller;
- no activation before the normal autonomic controller and sepsis state are independently validated.
