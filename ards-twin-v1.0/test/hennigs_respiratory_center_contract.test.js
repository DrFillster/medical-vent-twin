'use strict';
const assert=require('node:assert/strict');
const {
  makeHennigsShadowUnavailable,
}=require('../src/hennigs_respiratory_center_contract.js');

const s=makeHennigsShadowUnavailable({
  timeSec:0,
  arterialPo2MmHg:90,
  arterialPco2MmHg:40,
  airwayPressureCmH2O:8,
  airwayFlowLps:0,
  lungVolumeL:2.5,
});
assert.equal(s.controlAuthority,false);
assert.equal(s.respiratoryDrive,null);
assert.match(s.status,/blocked/);
console.log('ok - Hennigs interface fails closed pending source transcription');
