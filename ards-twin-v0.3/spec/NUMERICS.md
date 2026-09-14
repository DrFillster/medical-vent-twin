# Numerical Design

## Initial solver
Start with a deterministic fixed-step integrator. Do not optimize prematurely.

Recommended architecture:
- global simulation clock
- fixed `dt` configured centrally
- pure step functions where possible
- explicit invalid-state detection
- deterministic outputs for a fixed config/seed

## Timestep
The exact timestep should be selected through convergence testing rather than asserted from intuition. The implementation should support at least several candidate values and record convergence of:
- delivered Vt
- Ppeak
- plateau pressure during hold
- end-expiratory volume
- waveform extrema

## Algebraic solves
If the nonlinear elastic law requires inverse pressure-volume evaluation, use a bounded numerical solve with explicit failure states. Do not silently clamp invalid targets.

## Conservation checks
At every step:
- total airway flow should equal sum of compartment flows within numerical tolerance
- total volume change should match integrated net flow within tolerance
- compartment recruitment must stay in [0,1]
- pressures/volumes must remain finite

## Determinism
All acceptance tests must run without browser timing dependence. The numerical engine should be callable headlessly.
