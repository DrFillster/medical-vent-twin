'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { listBerlinCases } = require('../src/berlin_case_catalog.js');
const {
  assessBerlinCaseReadiness,
} = require('../src/clinical_case_readiness.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function manifest() {
  const p = path.resolve(__dirname, '../web/clinical-cases.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

test('browser clinical manifest contains exactly the canonical nine cases', () => {
  const m = manifest();
  const canonical = listBerlinCases();
  assert(m.schema === 'vent-clinical-case-manifest/v1');
  assert(m.cases.length === canonical.length);
  assert(m.cases.length === 9);
  assert(m.cases.map(c => c.id).join('|') === canonical.map(c => c.id).join('|'));
});

test('browser manifest preserves case identity, severity, recruitability and narrative', () => {
  const m = manifest();
  for (const c of listBerlinCases()) {
    const row = m.cases.find(x => x.id === c.id);
    assert(row, 'missing manifest row ' + c.id);
    assert(row.name === c.name);
    assert(row.synthetic === true);
    assert(row.severity === c.clinical.berlinSeverity);
    assert(row.recruitability === c.phenotype.recruitability);
    assert(row.narrative === c.clinical.narrative);
  }
});

test('browser readiness fields match canonical readiness status and values', () => {
  const m = manifest();
  for (const row of m.cases) {
    const canonical = assessBerlinCaseReadiness(row.id);
    assert(row.readiness.executable === canonical.executable);
    assert(row.readiness.status === canonical.status);
    const browserFields = Object.keys(row.readiness.fields).sort();
    const canonicalFields = Object.keys(canonical.fields).sort();
    assert(browserFields.join('|') === canonicalFields.join('|'),
      'readiness field mismatch for ' + row.id);
    for (const key of canonicalFields) {
      const a = row.readiness.fields[key];
      const b = canonical.fields[key];
      assert(a.status === b.status, row.id + ' ' + key + ' status mismatch');
      assert(a.value === b.value, row.id + ' ' + key + ' value mismatch');
      assert(a.source === b.source, row.id + ' ' + key + ' source mismatch');
      assert((a.note || null) === (b.note || null), row.id + ' ' + key + ' note mismatch');
    }
  }
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
