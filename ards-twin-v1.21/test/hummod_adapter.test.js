'use strict';

const {
  createHumModSnapshotMapper,
  createHumModReplayProvider,
} = require('../src/hummod_adapter.js');
const { validateTwinProvider } = require('../src/digital_twin_contract.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('ok -', name);
    passed += 1;
  } catch (e) {
    console.error('FAIL -', name, ':', e.message);
    failed += 1;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const mapper = createHumModSnapshotMapper({
  modelVersion: 'test-revision',
  subjectId: 'synthetic-test',
  runId: 'run-001',
  fields: {
    timestampSec: 'clock.seconds',
    'gasExchange.pao2MmHg': 'arterial.o2',
    'gasExchange.paco2MmHg': 'arterial.co2',
    'hemodynamics.heartRatePerMin': 'cardio.hr',
  },
  requiredTargets: ['timestampSec', 'gasExchange.pao2MmHg'],
});

test('mapper uses only caller-supplied exact paths', () => {
  const snapshot = mapper({
    clock: { seconds: 10 },
    arterial: { o2: 81, co2: 39 },
    cardio: { hr: 94 },
    temptingButUnmappedValue: 999,
  });
  assert(snapshot.source.provider === 'HumMod');
  assert(snapshot.source.modelVersion === 'test-revision');
  assert(snapshot.source.subjectId === 'synthetic-test');
  assert(snapshot.source.runId === 'run-001');
  assert(snapshot.timestampSec === 10);
  assert(snapshot.gasExchange.pao2MmHg === 81);
  assert(snapshot.gasExchange.paco2MmHg === 39);
  assert(snapshot.hemodynamics.heartRatePerMin === 94);
  assert(snapshot.hemodynamics.cardiacOutputLPerMin === null);
});

test('mapper fails when a required verified source path is absent', () => {
  let threw = false;
  try { mapper({ clock: { seconds: 0 }, arterial: {} }); } catch (_) { threw = true; }
  assert(threw, 'missing required source path should fail');
});

test('mapper rejects unsupported target names and missing version metadata', () => {
  let throws = 0;
  try {
    createHumModSnapshotMapper({ modelVersion: '', fields: { timestampSec: 't' } });
  } catch (_) { throws++; }
  try {
    createHumModSnapshotMapper({ modelVersion: 'x', fields: { timestampSec: 't', 'made.up.field': 'x' } });
  } catch (_) { throws++; }
  assert(throws === 2, `expected 2 throws, got ${throws}`);
});

test('replay provider satisfies provider contract and samples deterministically', () => {
  const s0 = mapper({ clock: { seconds: 0 }, arterial: { o2: 90, co2: 38 }, cardio: { hr: 90 } });
  const s10 = mapper({ clock: { seconds: 10 }, arterial: { o2: 80, co2: 40 }, cardio: { hr: 95 } });
  const provider = createHumModReplayProvider({ snapshots: [s10, s0], trajectoryId: 'traj-1' });
  assert(validateTwinProvider(provider) === true);
  assert(provider.initialize() === s0);
  assert(provider.sample(5) === s0);
  assert(provider.sample(10) === s10);
  assert(provider.sample(999) === s10);
});

test('fixed replay refuses to invent intervention response', () => {
  const s0 = mapper({ clock: { seconds: 0 }, arterial: { o2: 90, co2: 38 }, cardio: { hr: 90 } });
  const provider = createHumModReplayProvider({ snapshots: [s0] });
  provider.initialize();
  let threw = false;
  try { provider.applyIntervention({ type: 'peep-change' }); } catch (_) { threw = true; }
  assert(threw, 'replay should reject unsupported dynamic interventions');
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
