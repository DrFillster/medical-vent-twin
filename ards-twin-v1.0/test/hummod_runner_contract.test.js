'use strict';

const {
  HUMMOD_RUN_REQUEST_SCHEMA,
  HUMMOD_SOURCE_CLOCK,
  createHumModRunRequest,
  assertRunnerClockVerified,
} = require('../src/hummod_runner_contract.js');
const {
  HUMMOD_STANDALONE_UPSTREAM,
  listVerifiedDirectMappings,
} = require('../src/hummod_standalone_manifest.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

test('run request pins upstream and defaults to verified direct symbols', () => {
  const r = createHumModRunRequest({
    trajectoryId: 'moderate-aspiration-reference-001',
    durationSec: 300,
    sampleIntervalSec: 5,
    scenarioId: 'berlin-moderate-moderate-aspiration',
  });
  assert(r.schema === HUMMOD_RUN_REQUEST_SCHEMA);
  assert(r.source.repository === HUMMOD_STANDALONE_UPSTREAM.repository);
  assert(r.source.revision === HUMMOD_STANDALONE_UPSTREAM.revision);
  assert(r.requestedOutput.symbols.length === listVerifiedDirectMappings().length);
  assert(r.executable === true);
  assert(r.blocker === null);
  assert(r.sourceClock.symbol === 'System.X');
  assert(r.sourceClock.unit === 'minute');
  assert(r.sourceClock.secondsPerUnit === 60);
  assert(r.sourceClock.conversionToTimestampSec === 'timestampSec = System.X * 60');
  assert(r.sourceClock.verificationStatus === 'verified-for-pinned-revision');
});

test('run request rejects unverified symbols and invalid cadence', () => {
  let threwSymbol = false;
  try {
    createHumModRunRequest({
      trajectoryId: 'x',
      durationSec: 30,
      sampleIntervalSec: 5,
      symbols: ['RightAtrium.Pressure'],
    });
  } catch (_) { threwSymbol = true; }
  assert(threwSymbol);

  let threwCadence = false;
  try {
    createHumModRunRequest({
      trajectoryId: 'x',
      durationSec: 5,
      sampleIntervalSec: 10,
    });
  } catch (_) { threwCadence = true; }
  assert(threwCadence);
});

test('pinned System.X clock contract is verified as minutes', () => {
  assert(HUMMOD_SOURCE_CLOCK.symbol === 'System.X');
  assert(HUMMOD_SOURCE_CLOCK.unit === 'minute');
  assert(HUMMOD_SOURCE_CLOCK.secondsPerUnit === 60);
  assert(HUMMOD_SOURCE_CLOCK.verificationSources.length >= 2);
});

test('clock assertion rejects a conversion inconsistent with the pinned contract', () => {
  const r = createHumModRunRequest({
    trajectoryId: 'x',
    durationSec: 30,
    sampleIntervalSec: 5,
  });
  let threw = false;
  try {
    assertRunnerClockVerified(r, {
      unit: 'second',
      secondsPerUnit: 1,
    });
  } catch (_) { threw = true; }
  assert(threw);
  assert(assertRunnerClockVerified(r) === r);
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
