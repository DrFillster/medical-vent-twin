'use strict';

const { Simulation } = require('../src/simulation.js');
const { PRESETS } = require('../src/presets.js');
const { SimvCandidateController } = require('../src/ventilator/simv_candidate.js');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function makeController() {
  return new SimvCandidateController({
    fio2: 0.4,
    peep: 5,
    mandatoryRatePerMin: 6,
    mandatoryPinspCmH2O: 10,
    mandatoryInspiratoryTimeSec: 0.8,
    pressureSupportCmH2O: 6,
    triggerPmusCmH2O: 1,
    cycleOffFraction: 0.25,
    minSupportInspiratoryTimeSec: 0.2,
    maxSupportInspiratoryTimeSec: 1.3,
    syncWindowSec: 1.0,
  });
}

function effort({ timeSec }) {
  const phase = timeSec % 3.2;
  return phase < 0.9 ? 4 : 0;
}

let rejected = false;
try {
  new SimvCandidateController({ fio2: 0.4, peep: 5 });
} catch (e) {
  rejected = /mandatoryRatePerMin/.test(e.message);
}
assert(rejected, 'SIMV candidate must fail closed without explicit timing/trigger inputs');

const controller = makeController();
const sim = new Simulation({
  params: PRESETS.phenotype_baseline(),
  controller,
  dt: 0.001,
  initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
  patientEffortProvider: effort,
});

sim.runFor(24);
const snap = controller.snapshot();
assert(snap.mandatoryBreathCount >= 2, 'SIMV must deliver scheduled mandatory breaths');
assert(snap.spontaneousBreathCount >= 2, 'SIMV must permit spontaneous supported breaths between mandatory breaths');

const inspPressures = sim.trace
  .filter(r => r.phase === 'INSPIRATION')
  .map(r => r.output.airwayPressure);
assert(inspPressures.some(p => p > 14.5), 'mandatory pressure breaths must reach PEEP + mandatory Pinsp');
assert(inspPressures.some(p => p > 10.5 && p < 12.5), 'spontaneous PS breaths must reach PEEP + PS');

assert(sim.trace.some(r => r.patientMusclePressureCmH2O >= 4),
  'SIMV trace must preserve patient effort');
assert(snap.controlAuthority === false);
assert(snap.authority === 'candidate-not-canonical');

console.log('ok - candidate SIMV interleaves mandatory PC breaths and spontaneous PS breaths');
console.log(JSON.stringify({
  mandatoryBreaths: snap.mandatoryBreathCount,
  spontaneousBreaths: snap.spontaneousBreathCount,
  totalBreaths: snap.breathIndex,
  lastCycleReason: snap.lastCycleReason,
}, null, 2));
