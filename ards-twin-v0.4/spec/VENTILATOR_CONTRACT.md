# Ventilator / Patient Contract

## Principle
The ventilator is a controller of boundary conditions. The patient is a dynamic physical system.

## Controller output

```ts
type BoundaryCondition =
  | { kind: 'FLOW'; flowLps: number; fio2: number }
  | { kind: 'PRESSURE'; pressureCmH2O: number; fio2: number };
```

### VC-A/C
During inspiration the ventilator requests flow. During pause it requests zero flow with a closed inspiratory boundary sufficient to observe static-equilibrium pressure in the model. During expiration it exposes the airway to PEEP pressure.

### PC-A/C
During inspiration the ventilator requests an airway pressure trajectory from PEEP to target inspiratory pressure. During expiration it requests PEEP.

## Mechanics output

```ts
interface MechanicsOutput {
  airwayPressure: number;
  airwayFlow: number;
  deliveredVolume: number;
  compartmentVolumes: number[];
  compartmentFlows: number[];
  compartmentPressures: number[];
}
```

## Plateau pressure
Do not define plateau pressure as an algebraic shortcut in the dynamic engine. It should be measured during an inspiratory hold after flow approaches zero under passive conditions.

## Total PEEP / auto-PEEP
Do not implement as a hard-coded formula. Later milestones should estimate total PEEP from end-expiratory mechanics and expiratory hold behavior.
