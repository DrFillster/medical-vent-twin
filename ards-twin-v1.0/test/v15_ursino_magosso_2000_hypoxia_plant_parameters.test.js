'use strict';

const assert=require('node:assert/strict');
const {
  SOURCE,VASCULAR_2000,PARENT_1998_EXTRASPLANCHNIC,partitionAudit,
}=require('../src/ursino_magosso_2000_hypoxia_plant_parameters.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function close(a,b,tol){
  return Math.abs(a-b)<=tol;
}

test('primary Table 1 identity and five systemic beds are pinned',()=>{
  assert.equal(SOURCE.doi,'10.1152/ajpheart.2000.279.1.H149');
  assert.equal(SOURCE.table,1);
  for(const key of ['sp','ep','mp','bp','hp']){
    assert(VASCULAR_2000[key],key);
  }
  assert.equal(VASCULAR_2000.totalBloodVolumeMl,5300);
});

test('2000 extrasplanchnic peripheral partition reproduces 1998 basal aggregate',()=>{
  const a=partitionAudit().peripheral;
  const p=PARENT_1998_EXTRASPLANCHNIC.peripheral;
  assert(close(a.C,p.C,1e-12));
  assert(close(a.Vu,p.Vu,0.05));
  assert(close(a.Rparallel,p.R,0.002));
});

test('2000 extrasplanchnic venous partition reproduces 1998 basal aggregate',()=>{
  const a=partitionAudit().venous;
  const p=PARENT_1998_EXTRASPLANCHNIC.venous;
  assert(close(a.C,p.C,0.02));
  assert(close(a.Vu,p.Vu,0.02));
  assert(close(a.Rparallel,p.R,0.0002));
});

test('brain and coronary beds remain distinct source compartments',()=>{
  assert(VASCULAR_2000.bp.R!==VASCULAR_2000.hp.R);
  assert(VASCULAR_2000.bv.R!==VASCULAR_2000.hv.R);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
