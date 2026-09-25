// UI scenario contract. Mechanics-only: no oxygenation claims or controls.
const { Simulation, VcAcController, PcAcController } = require('./simulation.js');
const { PRESETS } = require('./presets.js');
const { makePatientParams } = require('./contracts.js');
const VERSION = '0.4.5';
function validateScenario(s) {
  if (!s || !Object.hasOwn(PRESETS, s.preset)) throw new Error('Choose a listed mechanical phenotype.');
  if (!['VC', 'PC'].includes(s.mode)) throw new Error('Choose volume or pressure control.');
  const ranges = { peep: [0, 20], rr: [6, 40], breaths: [2, 10], dt: [0.0005, 0.005], recruitment: [0, 1] };
  if (s.mode === 'VC') Object.assign(ranges, { vt: [0.1, 1], flow: [0.1, 2], pause: [0, 2] });
  else Object.assign(ranges, { pinsp: [1, 40], ti: [0.2, 3] });
  for (const [key, [lo, hi]] of Object.entries(ranges)) {
    if (!Number.isFinite(s[key]) || s[key] < lo || s[key] > hi) throw new Error(`${key} must be between ${lo} and ${hi}.`);
  }
  if (!Number.isInteger(s.breaths)) throw new Error('Number of breaths must be a whole number.');
  const inspiration = s.mode === 'VC' ? s.vt / s.flow + s.pause : s.ti;
  if (inspiration >= 60 / s.rr) throw new Error('Inspiration is too long. Reduce tidal volume, pause, or rate; or increase inspiratory flow.');
  return s;
}
function createScenario(input) {
  const s = validateScenario(input);
  const params = makePatientParams(PRESETS[s.preset]());
  const controller = s.mode === 'VC'
    ? new VcAcController({ peep: s.peep, rr: s.rr, fio2: 0.4, vt: s.vt, inspiratoryFlow: s.flow, inspiratoryPause: s.pause })
    : new PcAcController({ peep: s.peep, rr: s.rr, fio2: 0.4, pinsp: s.pinsp, inspiratoryTime: s.ti, inspiratoryPause: 0 });
  // Normal tissue open, consolidated tissue closed. Recruitable fraction is
  // explicit and visible to the learner; reference has no recruitable pool.
  const recruitment = params.compartments.find(c => c.id === 'recruitable').fraction > 0 ? s.recruitment : 0;
  const sim = new Simulation({ params, controller, dt: s.dt, trackGas: false,
    initialPEEP: s.peep, initialRecruitmentState: { normal: 1, recruitable: recruitment, consolidated: 0 } });
  return { sim, duration: s.breaths * 60 / s.rr };
}
function summarize(sim, scenario) {
  const metrics = sim.metrics().filter(m => m.Ti > 0 && m.Te > 0).at(-1);
  if (!metrics) throw new Error('No complete breath available. Increase the number of breaths.');
  const trace = sim.trace;
  const stride = Math.max(1, Math.ceil(trace.length / 1200));
  const waveform = trace.filter((_, i) => i % stride === 0 || i === trace.length - 1).map(r => ({
    t: r.t, pressure: r.output.airwayPressure, flow: r.output.airwayFlow, volume: r.output.totalVolume * 1000,
  }));
  const stats = { steps: trace.length, newtonIterations: 0, substeps: 0, activeSetTransitions: 0, failures: 0 };
  for (const r of trace) {
    const s = r.output.solverStats || {};
    stats.newtonIterations += s.newtonIters || 0;
    stats.substeps += s.substeps || 0;
    stats.activeSetTransitions += s.activeSetTransitions || 0;
  }
  // Do not present a dynamic pressure as a measured plateau.
  const pauseRows = trace.filter(r => r.t >= metrics.breathStartT && r.t <= metrics.breathEndT && r.phase === 'PAUSE');
  const late = pauseRows.slice(Math.floor(pauseRows.length / 2));
  const plateauAvailable = scenario.mode === 'VC' && scenario.pause >= 0.1 && late.length > 0 && late.every(r =>
    Math.abs(r.output.airwayFlow) < 0.01 && (r.output.compartmentFlows || []).every(q => Math.abs(q) < 0.01));
  const shown = { ...metrics, Pplat: plateauAvailable ? metrics.Pplat : null, drivingPressure: plateauAvailable ? metrics.drivingPressure : null };
  return { version: VERSION, scenario: { ...scenario }, metrics: shown, waveform, stats,
    compartments: sim.state.compartments.map(c => ({ id: c.id, recruitment: c.recruitment, volume: c.volume, pressure: c.alveolarPressure })),
    plateauNote: plateauAvailable ? 'Plateau estimated during the late, low-flow inspiratory pause.' : 'Plateau and driving pressure require a settled, low-flow VC inspiratory pause; unavailable for this run.',
    scope: 'Educational mechanical model. No gas exchange or patient-specific validation.' };
}
function runScenario(s, progress = () => {}) {
  const { sim, duration } = createScenario(s);
  const limit = Math.ceil(duration / s.dt) + 2;
  let count = 0;
  while (sim.state.t < duration) {
    if (++count > limit) throw new Error('Simulation stopped: time did not advance.');
    const result = sim.step();
    if (result.failed) {
      const error = new Error(`Run stopped at ${sim.state.t.toFixed(3)} s: ${result.output.failureKind || 'STEP_FAILED'}. Try a smaller timestep or revise the scenario.`);
      error.diagnostics = result.output;
      throw error;
    }
    if (count % 1000 === 0) progress(Math.min(99, Math.floor(100 * sim.state.t / duration)));
  }
  return summarize(sim, s);
}
module.exports = { VERSION, validateScenario, createScenario, summarize, runScenario };
