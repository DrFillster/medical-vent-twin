'use strict';
const assert=require('node:assert/strict');
const {
  EFFECTOR,
  venousSympatheticContract,
}=require('../src/magosso_ursino_venous_shadow_contract.js');

const x=venousSympatheticContract();
assert.equal(x.fSvSpikesPerSec,null);
assert.equal(x.regionalUnstressedVolumeMl,null);
assert.equal(x.controlAuthority,false);
assert.match(x.status,/blocked/);
assert.equal(EFFECTOR.delaySec,5);
assert.equal(EFFECTOR.tauSec,20);
assert.equal(EFFECTOR.beds.splanchnic.baselineMl,961.6);
assert.equal(EFFECTOR.beds.splanchnic.gainMl,-265.4);
console.log('ok - venous sympathetic/capacitance path fails closed pending 2001 Eq. 1');
