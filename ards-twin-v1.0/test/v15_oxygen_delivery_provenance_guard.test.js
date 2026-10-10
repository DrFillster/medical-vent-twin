'use strict';

const assert=require('node:assert/strict');
const {
  CRITICAL_VENOUS_PO2_MMHG,
  CRITICAL_VENOUS_PO2_PROVENANCE,
}=require('../src/hummod_ards_core_runtime.js');

assert.equal(CRITICAL_VENOUS_PO2_MMHG,15);
assert.equal(
  CRITICAL_VENOUS_PO2_PROVENANCE.universalPhysiologicThreshold,
  false
);
assert.match(CRITICAL_VENOUS_PO2_PROVENANCE.status,/provisional-engineering/);
assert.equal(CRITICAL_VENOUS_PO2_PROVENANCE.sourceClaim,null);

console.log('ok - venous PO2 floor is explicitly non-universal and provisional');
