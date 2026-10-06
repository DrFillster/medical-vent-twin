export class SimulationClock {
  private _t = 0;
  constructor(public readonly dt: number) {
    if (!(dt > 0)) throw new Error('dt must be > 0');
  }
  get t(): number { return this._t; }
  step(): number { this._t += this.dt; return this._t; }
  reset(): void { this._t = 0; }
}
