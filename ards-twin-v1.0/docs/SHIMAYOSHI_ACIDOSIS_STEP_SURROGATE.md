# Shimayoshi respiratory-acidosis reduced-order surrogate

Date: 2026-10-11

## Status

Implemented as **shadow only**. It has no closed-loop pressure authority.\n\n**Status: secondary/deprecated for production shadow use.** The preferred path is the compressed validated source-grid surrogate because it retains the source trajectories directly and has an explicit compression-error bound.

Source:
- upstream: `atakeuti/TS-AT-SM-2026-IRmodel`
- pinned SHA: `6478d2ab0acbfc88d3da461d2594658bcb2798ca`
- validated CO2 source-grid run: `38164241750`

## Source experiment

The original Shimayoshi respiratory-acidosis equations were run at challenge
`CO2o_p2` values of 10, 15, 20, 25, and 30 percent. The source baseline is
5 percent.

No HR, MAP, CO, SV, SVR, arterial pH, or Vent bedside target was used in fitting.

## Reduced equations

Challenge:

```
r(t) = 1 - A(1 - exp(-t/tau_fast))
         + B(1 - exp(-t/tau_slow))
```

Recovery:

```
r(t) = 1 - A exp(-t/tau_fast)
         + B(1 - exp(-t/tau_slow))
```

where `r(t)` is source peak-Fb relative to an independently generated source
control reference.

Parameters are fitted independently at each source CO2 grid level. Between
source levels, A and B are linearly interpolated; the two time constants are
interpolated in log space. Extrapolation outside 10-30 percent is rejected.

## Why this is stateful

The full source trajectories show hysteresis: nearly identical intracellular
pH values can correspond to materially different peak Fb depending on whether
the cell is entering acidosis or recovering. Therefore a static pH-to-force
curve is rejected.

The surrogate requires:
- source CO2 challenge level;
- challenge vs recovery phase;
- elapsed time in that phase.

It is not yet a general arbitrary-time-varying CO2 model.

## Held-out source validation

Neighboring source-level parameter sets were interpolated while withholding
intermediate source levels.

Maximum relative stress-ratio errors:

- challenge, 15 percent: 0.469 percent
- challenge, 20 percent: 0.748 percent
- challenge, 25 percent: 1.065 percent
- recovery, 15 percent: 0.762 percent
- recovery, 20 percent: 0.680 percent
- recovery, 25 percent: 0.570 percent

These are surrogate-vs-source errors, not clinical validation metrics.

## Authority

This surrogate may feed the existing myocardial LV-pressure **shadow**.
It must not control the closed-loop circulation until:
1. the HumMod myocardial CO2-to-Shimayoshi input bridge is dimensionally
   verified and tested;
2. the resulting LV-pressure shadow is validated;
3. no bedside-variable tuning is introduced.
