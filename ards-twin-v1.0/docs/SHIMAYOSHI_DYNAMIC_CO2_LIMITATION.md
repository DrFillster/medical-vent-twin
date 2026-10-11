# Shimayoshi dynamic CO2 history limitation

Date: 2026-10-11

## Result

The fixed-step compressed Shimayoshi acidosis grid is **not portable to
arbitrary changing CO2 histories without additional state**.

Dynamic source validation run:
- workflow run: `38166194835`
- pinned upstream SHA:
  `6478d2ab0acbfc88d3da461d2594658bcb2798ca`

The source experiment changed extracellular CO2 through:

```
5% -> 15% -> 25% -> 10% -> 30% -> 20% -> 5%
```

The cell equations were unchanged; only the external source CO2 stimulus was
changed.

## Fixed-step grid comparison

The dynamic source trajectory was compared with the independently validated
fixed-step source trajectories at the same CO2 level and absolute protocol
time.

Observed maximum relative stress-ratio error after CO2 history changed:

- 25% segment after prior 15% exposure: about 5.2%
- 10% segment after prior 15% -> 25% exposure: about 8.3%
- 30% segment after prior exposure: about 6.9%
- 20% segment after prior exposure: about 4.9%

The first 15% segment, which matches the original fixed-step experiment from
baseline, was essentially exact.

## Consequence

The browser grid is valid as a **fixed-step source surrogate**, not as a
memoryless function of instantaneous myocardial PCO2.

No empirical correction factor will be added.

Until a stateful reduced-order model is derived and independently validated,
the Shimayoshi acidosis path must fail closed when the myocardial CO2 challenge
changes materially during an active exposure.

The path remains shadow-only and has no closed-loop pressure authority.
