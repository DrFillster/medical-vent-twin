'use strict';

const { Simulation, VcAcController } = require('../src/simulation.js');
const { makePatientParams } = require('../src/contracts.js');
const { PRESETS } = require('../src/presets.js');
const { createVentToArdsCoreSnapshot } = require('../src/hummod_ards_core_coupling.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function makeSimulation() {
  const params = makePatientParams(PRESETS.phenotype_moderate_recruitability());
  const controller = new VcAcController({
    fio2: 0.6,
    peep: 8,
    rr: 20,
    vt: 0.42,
    inspiratoryFlow: 0.7,
    inspiratoryPause: 0.2,
  });
  return new Simulation({
    params,
    controller,
    dt: 0.002,
    trackGas: false,
    initialPEEP: 8,
    initialRecruitmentState: {
      normal: 1,
      recruitable: 0.35,
      consolidated: 0,
    },
  });
}

test('coupling snapshot preserves raw Vent state without systemic inference', () => {
  const sim = makeSimulation();
  sim.runFor(1);
  const snap = createVentToArdsCoreSnapshot(sim, { recentSamples: 25 });
  assert(snap.schema === 'vent-to-hummod-ards-core/v1');
  assert(snap.ventilator.mode === 'VC_AC');
  assert(snap.ventilator.peepCmH2O === 8);
  assert(snap.mechanics.compartments.length === 3);
  assert(snap.mechanics.recentTrace.length <= 25);
  assert(snap.couplingInterpretation.thoracicPressure === 'not-yet-derived');
  assert(snap.couplingInterpretation.shuntAndDeadSpace === 'not-yet-derived-by-ARDS-core');
});

test('coupling snapshot requires a Vent simulation', () => {
  let threw = false;
  try { createVentToArdsCoreSnapshot(null); } catch (_) { threw = true; }
  assert(threw);
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
