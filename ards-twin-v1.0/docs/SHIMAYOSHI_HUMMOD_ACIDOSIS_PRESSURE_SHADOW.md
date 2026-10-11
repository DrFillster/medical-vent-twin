# Preferred HumMod-to-Shimayoshi acidosis pressure shadow

Date: 2026-10-11

This is the preferred acidosis myocardial-depression shadow path.

```
HumMod LeftHeart-CO2.PCO2
  -> dimensional pressure-to-Shimayoshi CO2-percent conversion
  -> compressed validated Shimayoshi source-grid interpolation
  -> source peak Fb
  -> Kato/Utaki LV pressure bridge
  -> LV pressure shadow only
```

No HR, MAP, CO, SV, SVR, or arterial-pH target is used.

The source-grid surrogate is preferred over the earlier parametric step fit
because it retains the validated source trajectories directly and bounds its
piecewise-linear time-compression error.

## Important limitation

`sourceProtocolTimeS` is the time coordinate of the validated Shimayoshi
step-challenge protocol. Therefore this is not yet a general arbitrary
time-varying myocardial-CO2 model.

The module has:
- pressure-shadow eligibility inside the source grid;
- no closed-loop pressure authority;
- no control authority;
- no extrapolation outside the validated source CO2/time domain.
