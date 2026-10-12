'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'web/app.js'),'utf8');

assert.match(html,/Physician validation comparison/);
assert.match(html,/Live model vs candidate model/);
assert.match(html,/Candidate · no control authority/);
assert.match(html,/Candidate HR/);
assert.match(html,/Candidate MAP/);
assert.match(html,/Candidate cardiac output/);
assert.match(html,/Candidate stroke volume/);
assert.match(html,/Candidate systemic peripheral resistance/);
assert.match(html,/candidate is a parallel Ursino–Magosso 2000 cardiovascular model/i);

for(const id of [
  'clinical-compare-shadow-hr',
  'clinical-compare-shadow-map',
  'clinical-compare-shadow-co',
  'clinical-compare-shadow-sv',
  'clinical-compare-shadow-svr',
  'clinical-compare-status',
]){
  assert.match(html,new RegExp('id="'+id+'"'));
}

assert.match(app,/comparison\.candidateModel/);
assert.match(app,/candidateComparison\.heartRatePerMin/);
assert.match(app,/candidateComparison\.meanArterialPressureMmHg/);
assert.match(app,/candidateComparison\.cardiacOutputMlPerMin/);
assert.match(app,/candidateComparison\.strokeVolumeMl/);
assert.match(app,/candidateComparison\.systemicPeripheralResistanceMmHgMinPerL/);
assert.match(app,/candidateComparison\.knownLimitations/);
assert.match(app,/Candidate model unavailable/);

console.log('ok - physician comparison UI exposes non-canonical candidate hemodynamics and limitations');
