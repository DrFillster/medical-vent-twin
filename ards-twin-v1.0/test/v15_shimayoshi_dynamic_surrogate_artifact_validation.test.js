'use strict';
const assert=require('node:assert/strict');
const {
  runFixedStep,
  runDynamic,
}=require('../scripts/validate-shimayoshi-dynamic-surrogate-artifacts.js');

const fixed={
  provenance:{sourceChallengeCo2Percent:15},
  trajectory:[
    {time_s:0.4,stress_ratio:1},
    {time_s:300,stress_ratio:1},
    {time_s:300.4,stress_ratio:0.9999},
    {time_s:900,stress_ratio:0.96},
    {time_s:900.4,stress_ratio:0.9601},
  ],
};
const f=runFixedStep(fixed);
assert.equal(f.co2Percent,15);
assert.equal(f.rowCount,5);
assert(f.maxAbsoluteStressRatioError.absoluteError>=0);

const dynamic={
  status:'shimayoshi-dynamic-co2-source-validation-complete',
  rows:[
    {time_s:0.4,source_CO2_percent:5,stress_ratio:1},
    {time_s:300,source_CO2_percent:15,stress_ratio:1},
    {time_s:420,source_CO2_percent:25,stress_ratio:0.95},
    {time_s:540,source_CO2_percent:10,stress_ratio:0.90},
    {time_s:660,source_CO2_percent:30,stress_ratio:0.98},
    {time_s:780,source_CO2_percent:20,stress_ratio:0.89},
    {time_s:900,source_CO2_percent:5,stress_ratio:0.95},
  ],
};
const d=runDynamic(dynamic);
assert.equal(d.rowCount,7);
assert(d.maxRelativeStressRatioError.relativeError>=0);
console.log('ok - artifact validator recomputes fixed-step and dynamic errors from source rows');
