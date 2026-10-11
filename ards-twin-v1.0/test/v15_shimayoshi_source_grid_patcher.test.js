'use strict';

const assert=require('node:assert/strict');
const {
  patchProtocol,
  patchMain,
}=require('../scripts/patch-shimayoshi-source-grid.js');

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

const acid=patchProtocol(model,'acidosis');
assert.match(acid,/\/\/#define USE_ISCHEMIA_PROTOCOL/);
assert.match(acid,/^#define USE_Acidosis_PROTOCOL/m);

const mainFixture=[
  'int modelSim(double stepint, double period);//20210513',
  'void SFChange(double SF[]);',
  '    const double stepint = 0.1;  // <output interval (ms)> ',
  '    const double period = 3600; // <simulation period (s)>',
  '    modelSim(stepint, period);',
  '#if 0',
  '    main_dump2csv_EB(period);',
  '    char ContChar[32] = "Cont";',
  '    FNchange(ContChar, 0);',
  '#endif',
  '    main_dump2csv_EB(period);',
  '    char ContChar[32] = "Cont";',
  '    FNchange(ContChar, 0);',
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
assert.match(patched,/extern double CO2o_p2/);
assert.match(patched,/CO2o_p2 = atof\(argv\[5\]\)/);
assert.match(patched,/peak_Fb_mN_per_mm2/);
assert.doesNotMatch(patched,/cycleStartHsmL/);
assert.doesNotMatch(patched,/start_cycle_hsmL_um/);
assert.doesNotMatch(patched,/dump_results\(DumpFile, tb \+ tr, y, v\);/);
console.log('ok - fast source-grid patcher exposes CO2 input without mechanics instrumentation');
