'use strict';
const assert=require('assert');
const {independentMechanicsParams}=require('./independent_mechanics_controls');
const {recruitmentRate}=require('../../ards-twin-v1.0/src/recruitment');
const cp=independentMechanicsParams().compartments.find(c=>c.id==='recruitable');
const nestedChanged=JSON.parse(JSON.stringify(cp));nestedChanged.recruitment.P_open=100;
const current=recruitmentRate(.35,24,cp),changed=recruitmentRate(.35,24,nestedChanged),declared=recruitmentRate(.35,24,cp.recruitment);
assert.strictEqual(current,changed,'fixture expects ignored nested threshold');assert.strictEqual(current,0);assert(declared>0);
console.log(JSON.stringify({reproducedMismatch:true,templatePopen:cp.recruitment.P_open,probeDistendingPressure:24,currentRate:current,rateAfterNestedThreshold100:changed,rateUsingDeclaredNestedParameters:declared,productionEdited:false}));
