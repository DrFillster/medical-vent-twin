# Target Architecture

## Top-level modules

```
VirtualPatientConfig
       |
       v
PatientState <---- PhysiologicEngine ---- SimulationClock
       ^              |   |   |
       |              |   |   +-- GasExchange (later milestone)
       |              |   +------ Recruitment
       |              +---------- DynamicMechanics
       |
       +------- VentilatorEngine <---- VentilatorSettings
                       |
                       v
                    Monitor
```

## Non-negotiable separation

### Physiologic engine
Owns:
- compartment volumes
- compartment flows
- elastic recoil / pressure-volume law
- airway/chest-wall mechanics
- recruitment state
- gas-exchange state

Does **not** own:
- ventilator mode logic
- UI state
- educational scoring

### Ventilator engine
Owns:
- mode
- breath phase
- timing
- target flow or target pressure
- PEEP
- FiO2
- trigger logic later

Does **not** own:
- lung compliance
- recruitment
- gas exchange

### Monitor
Reads simulation outputs and derives display signals. It never changes physiology directly.

## Initial supported physiology
Three compartments:
1. normal/aerated
2. recruitable
3. poorly/non-aerated or consolidated

Each compartment receives independent state and parameter structures even when some v0.3 parameters are shared.

## Time-domain loop

At every numerical step:
1. Clock advances by `dt`.
2. Ventilator controller determines requested boundary condition for current breath phase.
3. Dynamic mechanics solves flow/pressure/volume response.
4. Recruitment update is initially disabled/frozen for Milestone 1-3.
5. State is committed.
6. Monitor samples raw signals.
7. Breath detector emits breath-summary events when expiration completes.

## Boundary-condition abstraction
The lung solver must accept either:
- pressure boundary condition `Paw(t)`, or
- flow boundary condition `Qaw(t)`

This is essential because VC and PC should use the same patient model.

## Mode extensibility test
Adding PC-A/C must require a new ventilator controller and tests, not a rewrite of lung mechanics.
