'use strict';
const assert = require('node:assert/strict');
const {summarizeSimulationMeasurements} = require('../src/bedside_measurements.js');
const completed={RR:20,VtExpired:0.419,VtInspired:0.42};
const partial={RR:180,VtExpired:0.001,VtInspired:0.002};
function summary(breaths){return summarizeSimulationMeasurements({metrics:()=>breaths,measurements:[],interventions:[],params:{}});}
assert.equal(summary([]).lastCompletedBreath,null);
assert.equal(summary([partial]).lastCompletedBreath,null);
assert.deepEqual(summary([completed,partial]).lastCompletedBreath,completed);
assert.equal(summary([completed,partial]).latestBreath,partial);
assert(Math.abs(summary([completed,partial]).lastCompletedBreath.VtExpired*summary([completed,partial]).lastCompletedBreath.RR-8.38)<1e-12);
console.log('ok - device measurement uses fully completed breath and expired volume, preserving existing partial-breath API');
