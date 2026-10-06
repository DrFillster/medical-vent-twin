import { BoundaryCondition, MechanicsOutput, PatientParams, PatientState } from './contracts';

export interface DynamicMechanics {
  step(
    params: PatientParams,
    state: PatientState,
    boundary: BoundaryCondition,
    dt: number
  ): { state: PatientState; output: MechanicsOutput };
}

export class ThreeCompartmentMechanics implements DynamicMechanics {
  step(
    _params: PatientParams,
    _state: PatientState,
    _boundary: BoundaryCondition,
    _dt: number
  ): { state: PatientState; output: MechanicsOutput } {
    throw new Error('TODO: implement dynamic mechanics; do not invent undocumented clinical equations');
  }
}
