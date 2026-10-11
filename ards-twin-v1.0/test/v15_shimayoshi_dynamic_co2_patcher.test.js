'use strict';

const assert=require('node:assert/strict');
const {
  SCHEDULE,
  patchDynamicProtocol,
  patchDynamicMain,
}=require('../scripts/patch-shimayoshi-dynamic-co2-validation.js');

const model=[
  '#define USE_ISCHEMIA_PROTOCOL',
  '#ifdef USE_ISCHEMIA_PROTOCOL',
  'x',
  '#endif',
  '//#define USE_Acidosis_PROTOCOL',
  '#ifdef USE_Acidosis_PROTOCOL',
  '    const double t_AsidosisOn = 5.0 * 60 * 1000;   // 1 min control',
  '    const double t_Recovery2On = 15.0 * 60 * 1000;  // 10 min asidosis',
  '    const double tau_a = 10E3;',
  '',
  '    if (t >= t_AsidosisOn && t < t_Recovery2On) {',
  '',
  '        flagAsidosis = 1;',
  '        CO2o_p = CO2o_p2; // ',
  '    }',
  '    else {',
  '        flagAsidosis = 0;',
  '        CO2o_p = 5.0; //',
  '    }',
  '#else',
  '    flagAsidosis = 0;',
  '    CO2o_p = 5.0;',
  '#endif',
].join('\n');

const patchedModel=patchDynamicProtocol(model);
assert.match(patchedModel,/CO2o_p = 15\.0/);
assert.match(patchedModel,/CO2o_p = 25\.0/);
assert.match(patchedModel,/CO2o_p = 10\.0/);
assert.match(patchedModel,/CO2o_p = 30\.0/);
assert.match(patchedModel,/CO2o_p = 20\.0/);
assert.equal(SCHEDULE[0].co2Percent,5);
assert.equal(SCHEDULE[SCHEDULE.length-1].co2Percent,5);
console.log('ok - dynamic validation patch installs deterministic multistep CO2 stimulus');

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

const patchedMain=patchDynamicMain(mainFixture);
assert.match(patchedMain,/extern double CO2o_p;/);
assert.match(patchedMain,/source_CO2_percent/);
assert.match(patchedMain,/peakCai, CO2o_p\);/);
assert.doesNotMatch(patchedMain,/cycleStartHsmL/);
console.log('ok - dynamic validation output observes source CO2 without sarcomere instrumentation');
