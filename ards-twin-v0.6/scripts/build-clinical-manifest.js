'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { listBerlinCases } = require('../src/berlin_case_catalog.js');
const { assessBerlinCaseReadiness } = require('../src/clinical_case_readiness.js');

const root = path.resolve(__dirname, '..');
const cases = listBerlinCases().map(c => {
  const readiness = assessBerlinCaseReadiness(c.id);
  return {
    id: c.id,
    name: c.name,
    synthetic: c.synthetic,
    severity: c.clinical.berlinSeverity,
    recruitability: c.phenotype.recruitability,
    narrative: c.clinical.narrative,
    readiness: {
      executable: readiness.executable,
      status: readiness.status,
      fields: readiness.fields,
    },
  };
});

const manifest = {
  schema: 'vent-clinical-case-manifest/v1',
  generatedFrom: 'src/berlin_case_catalog.js + src/clinical_case_readiness.js',
  intendedUse: 'education-and-research-simulation',
  note: 'Synthetic cases. Cohort-calibrated targets are not individual patient truth.',
  cases,
};

const target = path.join(root, 'web', 'clinical-cases.json');
fs.writeFileSync(target, JSON.stringify(manifest, null, 2) + '\n');
console.log('Built web/clinical-cases.json from ' + cases.length + ' canonical cases.');
