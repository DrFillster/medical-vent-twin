# State Ownership and Schema

## Static patient parameters
These define the virtual patient and should not change during a short simulation unless an explicit pathophysiology module changes them.

```ts
interface CompartmentParams {
  id: 'normal' | 'recruitable' | 'consolidated';
  fraction: number;
  resistance: number;          // cmH2O / (L/s)
  capacity: number;            // L above reference
  elasticScale: number;        // model-specific pressure scale
  perfusionFraction: number;
  deadSpaceFraction: number;
}

interface PatientParams {
  compartments: CompartmentParams[];
  centralAirwayResistance: number;
  airwayOpeningPressure: number;
  chestWall: ChestWallParams;
  metabolism: MetabolismParams;
}
```

## Dynamic patient state

```ts
interface CompartmentState {
  volume: number;              // L
  flow: number;                // L/s
  alveolarPressure: number;    // cmH2O
  recruitment: number;         // 0..1
}

interface PatientState {
  t: number;
  compartments: CompartmentState[];
  airwayPressure: number;
  totalFlow: number;
  totalVolume: number;
  gas?: GasState;
}
```

## Ventilator settings

```ts
interface VentilatorSettings {
  mode: 'VC_AC' | 'PC_AC';
  fio2: number;
  peep: number;
  rr: number;
  vt?: number;
  inspiratoryFlow?: number;
  flowPattern?: 'square' | 'decelerating';
  inspiratoryPause?: number;
  pinsp?: number;
  ti?: number;
  riseTime?: number;
}
```

## Ventilator runtime state
Separate settings from runtime state.

```ts
interface VentilatorRuntime {
  phase: 'EXPIRATION' | 'INSPIRATION' | 'PAUSE';
  breathIndex: number;
  phaseTime: number;
  cycleTime: number;
}
```

## Events
Recommended events:
- `BreathStarted`
- `InspiratoryPauseStarted`
- `ExpirationStarted`
- `BreathCompleted`
- `InvalidState`
- later: `TriggerDetected`, `AutoPEEPDetected`, `RecruitmentChanged`
