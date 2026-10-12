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
assert.match(html,/existing candidate is a parallel Ursino–Magosso 2000 cardiovascular model/i);
assert.match(html,/HumMod 2013 compensation channel/i);
assert.match(html,/HumMod 2013 compensation HR/);
assert.match(html,/2013 chemoreceptor firing/);
assert.match(html,/2013 CNS chemoreflex effect/);
assert.match(html,/2013 cardiac sympathetic/);
assert.match(html,/2013 adrenal sympathetic/);
assert.match(html,/2013 general sympathetic/);

for(const id of [
  'clinical-compare-shadow-hr',
  'clinical-compare-shadow-map',
  'clinical-compare-shadow-co',
  'clinical-compare-shadow-sv',
  'clinical-compare-shadow-svr',
  'clinical-compare-hm2013-hr',
  'clinical-compare-hm2013-chemo',
  'clinical-compare-hm2013-cns',
  'clinical-compare-hm2013-cardiac-symps',
  'clinical-compare-hm2013-adrenal-symps',
  'clinical-compare-hm2013-general-symps',
  'clinical-compare-hm2013-ne',
  'clinical-compare-hm2013-epi',
  'clinical-compare-hm2013-beta1',
  'clinical-compare-status',
]){
  assert.match(html,new RegExp('id="'+id+'"'));
}

assert.match(app,/comparison\.candidateModel/);
assert.match(app,/comparison\.hummod2013Compensation/);
assert.match(app,/hummod2013Comparison\.heartRatePerMin/);
assert.match(app,/hummod2013Comparison\.chemoreceptorFiringRate/);
assert.match(app,/hummod2013Comparison\.chemoCnsEffect/);
assert.match(app,/hummod2013Comparison\.cardiacSympatheticHz/);
assert.match(app,/hummod2013Comparison\.epinephrinePgPerMl/);
assert.match(app,/hummod2013Comparison\.norepinephrinePgPerMl/);
assert.match(app,/candidateComparison\.heartRatePerMin/);
assert.match(app,/candidateComparison\.meanArterialPressureMmHg/);
assert.match(app,/candidateComparison\.cardiacOutputMlPerMin/);
assert.match(app,/candidateComparison\.strokeVolumeMl/);
assert.match(app,/candidateComparison\.systemicPeripheralResistanceMmHgMinPerL/);
assert.match(app,/candidateComparison\.knownLimitations/);
assert.match(app,/Candidate model unavailable/);

console.log('ok - physician comparison UI exposes non-canonical candidate hemodynamics and limitations');
