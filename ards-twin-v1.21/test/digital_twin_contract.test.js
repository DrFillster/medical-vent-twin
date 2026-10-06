'use strict';

const {
  TWIN_SCHEMA_VERSION,
  makeTwinSnapshot,
  validateTwinProvider,
} = require('../src/digital_twin_contract.js');

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

test('snapshot accepts partial source data without inventing missing physiology', () => {
  const s = makeTwinSnapshot({
    provider: 'test-provider',
    subjectId: 'synthetic-001',
    timestampSec: 12.5,
    respiratory: { complianceMlPerCmH2O: 34, shuntFraction: 0.22 },
    hemodynamics: { heartRatePerMin: 92 },
  });
  assert(s.schemaVersion === TWIN_SCHEMA_VERSION);
  assert(s.source.provider === 'test-provider');
  assert(s.respiratory.complianceMlPerCmH2O === 34);
  assert(s.respiratory.shuntFraction === 0.22);
  assert(s.gasExchange.pao2MmHg === null);
  assert(s.hemodynamics.cardiacOutputLPerMin === null);
  assert(s.metabolism.co2ProductionMlPerMin === null);
});

test('snapshot rejects invalid fractions and non-finite values', () => {
  let throws = 0;
  try { makeTwinSnapshot({ timestampSec: 0, respiratory: { shuntFraction: 1.2 } }); } catch (_) { throws++; }
  try { makeTwinSnapshot({ timestampSec: NaN }); } catch (_) { throws++; }
  try { makeTwinSnapshot({ timestampSec: 0, gasExchange: { paco2MmHg: Infinity } }); } catch (_) { throws++; }
  assert(throws === 3, `expected 3 throws, got ${throws}`);
});

test('provider contract requires initialize, sample, and applyIntervention', () => {
  const provider = {
    initialize() {},
    sample() {},
    applyIntervention() {},
  };
  assert(validateTwinProvider(provider) === true);
  let threw = false;
  try { validateTwinProvider({ initialize() {}, sample() {} }); } catch (_) { threw = true; }
  assert(threw, 'incomplete provider should fail');
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
