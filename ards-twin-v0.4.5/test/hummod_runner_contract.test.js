'use strict';

const {
  HUMMOD_RUN_REQUEST_SCHEMA,
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
  assert(r.executable === false);
  assert(r.sourceClock.symbol === 'System.X');
  assert(r.sourceClock.unit === null);
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

test('run request cannot become executable without explicit source-clock verification', () => {
  const r = createHumModRunRequest({
    trajectoryId: 'x',
    durationSec: 30,
    sampleIntervalSec: 5,
  });
  let threw = false;
  try {
    assertRunnerClockVerified(r, {
      verified: false,
      sourceClockUnit: 'unknown',
      verificationSource: 'none',
    });
  } catch (_) { threw = true; }
  assert(threw);
});

test('verified clock receipt preserves verification provenance', () => {
  const r = createHumModRunRequest({
    trajectoryId: 'x',
    durationSec: 30,
    sampleIntervalSec: 5,
  });
  const ready = assertRunnerClockVerified(r, {
    verified: true,
    sourceClockUnit: 'verified-unit-placeholder',
    verificationSource: 'test-fixture-only',
  });
  assert(ready.executable === true);
  assert(ready.blocker === null);
  assert(ready.sourceClock.verificationStatus === 'verified');
  assert(ready.sourceClock.verificationSource === 'test-fixture-only');
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
