'use strict';

const assert=require('node:assert/strict');
const {compareDynamicSource}=require('../scripts/compare-shimayoshi-dynamic-grid.js');

const dynamic={
  status:'shimayoshi-dynamic-co2-source-validation-complete',
  rows:[
    {time_s:300,protocol:'acidosis',source_CO2_percent:15,stress_ratio:0.9999975662084375},
    {time_s:420,protocol:'acidosis',source_CO2_percent:25,stress_ratio:0.95},
    {time_s:540,protocol:'acidosis',source_CO2_percent:10,stress_ratio:0.98},
    {time_s:900,protocol:'control',source_CO2_percent:5,stress_ratio:1.0},
  ],
  segments:[
    {startS:300,endS:420,co2Percent:15,phase:'acidosis'},
    {startS:420,endS:540,co2Percent:25,phase:'acidosis'},
    {startS:540,endS:660,co2Percent:10,phase:'acidosis'},
    {startS:900,endS:null,co2Percent:5,phase:'control'},
  ],
};

const x=compareDynamicSource(dynamic);
assert.equal(x.status,'dynamic-source-vs-fixed-step-grid-comparison-complete');
assert.equal(x.closedLoopAuthority,false);
assert.equal(x.comparableRowCount,4);
assert(x.meanAbsoluteStressRatioError>=0);
assert(x.segments.length===4);
console.log('ok - dynamic source comparison quantifies fixed-step grid history error without authority');
