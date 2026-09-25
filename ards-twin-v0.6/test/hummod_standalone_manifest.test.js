'use strict';

const {
  HUMMOD_STANDALONE_UPSTREAM,
  HUMMOD_STANDALONE_SYMBOLS,
  listVerifiedDirectMappings,
} = require('../src/hummod_standalone_manifest.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

test('pins an exact upstream HumMod revision', () => {
  assert(HUMMOD_STANDALONE_UPSTREAM.repository === 'riliescu/hummod-standalone');
  assert(/^[0-9a-f]{40}$/.test(HUMMOD_STANDALONE_UPSTREAM.revision), 'expected full commit SHA');
});

test('direct mappings contain only source-verified compatible units', () => {
  const mappings = listVerifiedDirectMappings();
  const targets = new Set(mappings.map(x => x.target));
  [
    'gasExchange.pao2MmHg',
    'gasExchange.paco2MmHg',
    'gasExchange.ph',
    'hemodynamics.heartRatePerMin',
    'hemodynamics.meanArterialPressureMmHg',
    'hemodynamics.cardiacOutputLPerMin',
  ].forEach(target => assert(targets.has(target), `missing direct mapping: ${target}`));
});

test('oxygen saturation is not silently converted from percent to fraction', () => {
  const sat = HUMMOD_STANDALONE_SYMBOLS.arterialO2SaturationPercent;
  assert(sat.sourceUnit === 'percent');
  assert(sat.normalizedUnit === 'fraction');
  assert(sat.status.includes('requires-explicit-unit-transform'));
  assert(!listVerifiedDirectMappings().some(x => x.target === 'gasExchange.spo2Fraction'));
});

test('right atrial pressure is not silently relabeled as CVP', () => {
  const rap = HUMMOD_STANDALONE_SYMBOLS.rightAtrialPressure;
  assert(rap.symbol === 'RightAtrium.Pressure');
  assert(rap.normalizedTarget === null);
  assert(rap.candidateNormalizedTarget === 'hemodynamics.centralVenousPressureMmHg');
  assert(rap.status.includes('semantic-mapping-pending'));
});

test('metabolic totals stay unmapped until upstream units are verified', () => {
  const o2 = HUMMOD_STANDALONE_SYMBOLS.wholeBodyO2Outflow;
  const co2 = HUMMOD_STANDALONE_SYMBOLS.wholeBodyCO2Inflow;
  assert(o2.normalizedTarget === null && co2.normalizedTarget === null);
  assert(o2.status.includes('unit-verification-pending'));
  assert(co2.status.includes('unit-verification-pending'));
});

test('timestamp is execution metadata rather than an invented HumMod physiology symbol', () => {
  const t = HUMMOD_STANDALONE_SYMBOLS.timestamp;
  assert(t.symbol === null);
  assert(t.status === 'export-envelope-required');
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
