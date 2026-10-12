'use strict';

const assert=require('node:assert/strict');
const {
  EFFECTOR_REFERENCE,
  venousSympatheticContract,
}=require('../src/magosso_ursino_venous_shadow_contract.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('venous downstream volume path still fails closed without f_sv',()=>{
  const x=venousSympatheticContract();
  assert.equal(x.fSvSpikesPerSec,null);
  assert.equal(x.regionalUnstressedVolumeMl,null);
  assert.equal(x.controlAuthority,false);
  assert.equal(x.neuralChannelStatus,'awaiting-source-candidate-f_sv');
  assert.match(x.downstreamStatus,/blocked/);
});

test('source-candidate f_sv may be carried through without granting volume authority',()=>{
  const x=venousSympatheticContract({fSvSpikesPerSec:7.5});
  assert.equal(x.fSvSpikesPerSec,7.5);
  assert.equal(x.neuralChannelStatus,'source-candidate-f_sv-available');
  assert.equal(x.regionalUnstressedVolumeMl,null);
  assert.equal(x.controlAuthority,false);
});

test('effector inventory remains explicitly non-authoritative',()=>{
  assert.equal(EFFECTOR_REFERENCE.delaySec,5);
  assert.equal(EFFECTOR_REFERENCE.tauSec,20);
  assert.equal(EFFECTOR_REFERENCE.beds.splanchnic.baselineMl,1361.6);
  assert.equal(EFFECTOR_REFERENCE.beds.splanchnic.gainMl,-265.4);
  assert.match(
    EFFECTOR_REFERENCE.beds.splanchnic.provenance,
    /primary baseline reconciliation required/
  );
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
