'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.stack || e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function loadGeneratedVentBundle() {
  const enginePath = path.resolve(__dirname, '../web/engine.js');
  const source = fs.readFileSync(enginePath, 'utf8');
  const context = {
    console,
    setTimeout,
    clearTimeout,
    Math,
    JSON,
    Object,
    Array,
    Number,
    String,
    Boolean,
    Date,
    Error,
    TypeError,
    RangeError,
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: enginePath });
  if (!context.VENT) throw new Error('generated web/engine.js did not expose VENT');
  return context.VENT;
}

function makeLiveSession(VENT) {
  return VENT.createBerlinLiveHumModSession({
    caseId: 'berlin-moderate-moderate-aspiration',
    ventilation: {
      mode: 'VC_AC',
      fio2: 0.60,
      peep: 8,
      rr: 20,
      vtL: 0.42,
      inspiratoryFlowLps: 0.70,
      inspiratoryPauseSec: 0.20,
    },
    initialRecruitmentState: {
      normal: 1,
      recruitable: 0.35,
      consolidated: 0,
    },
    dt: 0.002,
    mechanicalWarmupSec: 3,
  });
}

test('v1.21 generated browser bundle runs live HumMod beyond the 2-second regression point', () => {
  const VENT = loadGeneratedVentBundle();
  assert(typeof VENT.createBerlinLiveHumModSession === 'function',
    'generated bundle is missing createBerlinLiveHumModSession');

  const session = makeLiveSession(VENT);
  const initialized = session.initialize();
  assert(initialized.timeSec >= 1,
    'live session did not complete its initialization step');

  const after = session.runFor(3);
  assert(after.timeSec >= 4,
    'live session failed to advance past the prior 2-second stop');
  assert(Number.isFinite(after.systemic.hemodynamics.heartRatePerMin),
    'heart rate became non-finite');
  assert(Number.isFinite(after.systemic.hemodynamics.meanArterialPressureMmHg),
    'MAP became non-finite');
  assert(Number.isFinite(after.systemic.hemodynamics.cardiacOutputMlPerMin),
    'cardiac output became non-finite');
  assert(after.systemic.hemodynamics.catecholamines,
    'v1.21 live bundle is missing the source-aligned catecholamine state');
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
