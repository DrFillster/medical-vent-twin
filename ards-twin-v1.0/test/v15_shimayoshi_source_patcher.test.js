'use strict';

const assert=require('node:assert/strict');
const {patchProtocol,patchMain}=require('../scripts/patch-shimayoshi-source-extraction.js');

const model=[
  '#define USE_ISCHEMIA_PROTOCOL',
  '#ifdef USE_ISCHEMIA_PROTOCOL',
  'x',
  '#endif',
  '//#define USE_Acidosis_PROTOCOL',
  '#ifdef USE_Acidosis_PROTOCOL',
  'y',
  '#endif'
].join('\n');

const control=patchProtocol(model,'control');
assert.match(control,/\/\/#define USE_ISCHEMIA_PROTOCOL/);
assert.match(control,/\/\/#define USE_Acidosis_PROTOCOL/);
console.log('ok - control extraction disables both source challenge protocols');

const acid=patchProtocol(model,'acidosis');
assert.match(acid,/\/\/#define USE_ISCHEMIA_PROTOCOL/);
assert.match(acid,/^#define USE_Acidosis_PROTOCOL/m);
console.log('ok - acidosis extraction enables only source acidosis protocol');

const ischemia=patchProtocol(model,'ischemia');
assert.match(ischemia,/^#define USE_ISCHEMIA_PROTOCOL/m);
assert.match(ischemia,/\/\/#define USE_Acidosis_PROTOCOL/);
console.log('ok - ischemia extraction enables only source ischemia protocol');

const mainFixture=[
  'int modelSim(double stepint, double period);//20210513',
  'void SFChange(double SF[]);',
  '    const double period = 3600; // <simulation period (s)>',
  '    modelSim(stepint, period);',
  'int modelSim(double stepint, double period)',
  '{',
  '    FILE* DumpFile;//20210319',
  '    DumpFile = fopen("C:/Simdata/dump.dat", "wb"); ',
  '        dump_results(DumpFile, tb + tr, y, v);',
  '        if (fabs(tr - STIM_INTERVAL) <= DBL_EPSILON * STIM_INTERVAL) {',
  '    fclose(DumpFile);',
  '    return 0;',
].join('\n');

const patched=patchMain(mainFixture);
assert.match(patched,/shimayoshi_cycles\.csv/);
assert.match(patched,/peak_Fb_mN_per_mm2/);
assert.match(patched,/IDX_Fb/);
assert.match(patched,/IDX_Cyt_pHi/);
assert.match(patched,/IDX_ATPTotal/);
assert.match(patched,/fopen\("NUL"/);
assert.match(patched,/double dyCompact\[NOPRungeKutta_\]/);
assert.doesNotMatch(patched,/dump_results\(DumpFile, tb \+ tr, y, v\);/);
console.log('ok - extraction patch adds compact source-state cycle output only');
