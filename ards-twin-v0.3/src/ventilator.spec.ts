import { BoundaryCondition, PatientState } from './contracts';

export interface VentilatorController {
  step(state: PatientState, dt: number): BoundaryCondition;
}

export interface VcAcSettings {
  fio2: number;
  peep: number;
  rr: number;
  vt: number;
  inspiratoryFlow: number;
  inspiratoryPause: number;
}

// Intentionally incomplete: implementation LLM must define phase timing,
// expiration behavior, validity rules, and breath accounting with tests.
export class VcAcController implements VentilatorController {
  constructor(public readonly settings: VcAcSettings) {}
  step(_state: PatientState, _dt: number): BoundaryCondition {
    throw new Error('TODO: implement VC-A/C controller per spec/VENTILATOR_CONTRACT.md');
  }
}
