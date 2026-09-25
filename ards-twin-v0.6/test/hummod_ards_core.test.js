'use strict';

const {
  HUMMOD_ARDS_CORE,
  hummodArdsCoreRootSymbols,
  hummodArdsCoreRootStructures,
} = require('../src/hummod_ards_core_manifest.js');
const {
  structureName,
  referencedStructures,
  dependencyClosure,
} = require('../scripts/build-hummod-ards-core-graph.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

test('core manifest contains acute ARDS outputs', () => {
  const symbols = hummodArdsCoreRootSymbols();
  for (const required of [
    'PO2Artys.Pressure',
    'CO2Artys.Pressure',
    'BloodPh.ArtysPh',
    'Heart-Rate.Rate',
    'SystemicArtys.Pressure',
    'CardiacOutput.Flow(L/Min)',
    'RightAtrium.Pressure',
    'PulmArty.Pressure',
  ]) assert(symbols.includes(required), 'missing ' + required);

  assert(HUMMOD_ARDS_CORE.timeHorizon.intended === 'seconds-to-tens-of-minutes');
  assert(HUMMOD_ARDS_CORE.ventToCoreBoundary.length >= 5);
});

test('root structures are unique and source-name based', () => {
  const roots = hummodArdsCoreRootStructures();
  assert(new Set(roots).size === roots.length);
  assert(roots.includes('PO2Artys'));
  assert(roots.includes('PulmArty'));
  assert(roots.includes('RightAtrium'));
});

test('DES structure parser extracts names and dependencies', () => {
  const text = [
    '<structure><name> Example </name>',
    '<definitions><block><name> Calc </name>',
    '<def><name> X </name><val> A.One + B.Two </val></def>',
    '<call> C.DoWork </call>',
    '</block></definitions></structure>',
  ].join('\n');
  assert(structureName(text) === 'Example');
  const deps = referencedStructures(text, 'Example');
  assert(deps.includes('A'));
  assert(deps.includes('B'));
  assert(deps.includes('C'));
});

test('dependency closure preserves depth and reports missing structures', () => {
  const index = new Map([
    ['Root', { structure: 'Root', path: 'Structure/A/Root.DES', dependencies: ['A','B'] }],
    ['A', { structure: 'A', path: 'Structure/A/A.DES', dependencies: ['C'] }],
    ['B', { structure: 'B', path: 'Structure/B/B.DES', dependencies: [] }],
    ['C', { structure: 'C', path: 'Structure/C/C.DES', dependencies: ['Missing'] }],
  ]);
  const closure = dependencyClosure(index, ['Root'], 10);
  const byName = new Map(closure.structures.map(x => [x.structure, x]));
  assert(byName.get('Root').depth === 0);
  assert(byName.get('A').depth === 1);
  assert(byName.get('C').depth === 2);
  assert(closure.missing.includes('Missing'));
});

test('excluded slow systems remain explicit boundaries', () => {
  const states = HUMMOD_ARDS_CORE.initialExternalizedBoundaries.map(x => x.status);
  assert(states.includes('held-at-baseline-in-phase-1'));
  assert(states.includes('excluded-from-ARDS-core'));
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
