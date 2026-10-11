'use strict';
const assert=require('node:assert/strict');
const {
  REQUIRED_FIELDS,
  auditMyocardialFlowInputs,
}=require('../src/hummod_myocardial_flow_input_contract.js');

const empty=auditMyocardialFlowInputs({});
assert.equal(empty.complete,false);
assert.equal(empty.missing.length,REQUIRED_FIELDS.length);
assert.equal(empty.fixedCoronaryFractionSubstitutionAllowed,false);
assert.equal(empty.nominalHormoneBackfillAllowed,false);

const complete=Object.fromEntries(REQUIRED_FIELDS.map((k,i)=>[k,i+1]));
const ok=auditMyocardialFlowInputs(complete);
assert.equal(ok.complete,true);

const bad=auditMyocardialFlowInputs({...complete,adhPoolLog10Conc:NaN});
assert.equal(bad.complete,false);
assert.deepEqual(bad.invalid,['adhPoolLog10Conc']);
console.log('ok - myocardial flow prerequisites fail closed without source upstream states');
