'use strict';
const assert=require('node:assert/strict');
const {
  REQUIRED_FIELDS,
  auditMyocardialAcidBaseInputs,
  requireMyocardialAcidBaseInputs,
}=require('../src/hummod_myocardial_acid_base_input_contract.js');

const empty=auditMyocardialAcidBaseInputs({});
assert.equal(empty.complete,false);
assert.equal(empty.missing.length,REQUIRED_FIELDS.length);
assert.equal(empty.arterialPco2SubstitutionAllowed,false);
assert.equal(empty.nominalBackfillAllowed,false);

const complete=Object.fromEntries(REQUIRED_FIELDS.map((k,i)=>[k,i+1]));
const ok=auditMyocardialAcidBaseInputs(complete);
assert.equal(ok.complete,true);
assert.deepEqual(requireMyocardialAcidBaseInputs(complete),complete);

assert.throws(
  ()=>requireMyocardialAcidBaseInputs({...complete,liquidVolumeMl:null}),
  /liquidVolumeMl/
);
console.log('ok - live myocardial acid-base contract fails closed on missing source states');
