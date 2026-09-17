export type BoundaryCondition =
  | { kind: 'FLOW'; flowLps: number; fio2: number }
  | { kind: 'PRESSURE'; pressureCmH2O: number; fio2: number };

export interface CompartmentParams {
  id: 'normal' | 'recruitable' | 'consolidated';
  fraction: number;
  resistance: number;
  capacity: number;
  elasticScale: number;
  perfusionFraction: number;
  deadSpaceFraction: number;
}

export interface CompartmentState {
  volume: number;
  flow: number;
  alveolarPressure: number;
  recruitment: number;
}

export interface PatientParams {
  compartments: CompartmentParams[];
  centralAirwayResistance: number;
  airwayOpeningPressure: number;
}

export interface PatientState {
  t: number;
  compartments: CompartmentState[];
  airwayPressure: number;
  totalFlow: number;
  totalVolume: number;
}

export interface MechanicsOutput {
  airwayPressure: number;
  airwayFlow: number;
  deliveredVolume: number;
  compartmentVolumes: number[];
  compartmentFlows: number[];
  compartmentPressures: number[];
}
