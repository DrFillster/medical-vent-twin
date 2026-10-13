'use strict';

const assert=require('node:assert/strict');
const {
  createHumMod2013KCellRuntime,
}=require('../src/hummod_2013_kcell_runtime.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('KCell runtime initializes from source 140 mEq/L concentration',()=>{
  const r=createHumMod2013KCellRuntime({initialIcfvMl:20000});
  const s=r.snapshot({cellWaterVolumeMl:20000});
  assert(Math.abs(s.concentrationMeqPerL-140)<1e-12);
  assert.equal(s.canonicalControlAuthority,false);
});

test('KCell mass follows source gain-minus-loss direction',()=>{
  const r=createHumMod2013KCellRuntime({initialIcfvMl:20000});
  const before=r.snapshot({cellWaterVolumeMl:20000});
  const after=r.step({
    dtSec:60,
    kPoolMassMeq:0,
    delayedAldosteroneEffect:1,
    cellWaterVolumeMl:20000,
  });
  assert(after.massMeq<before.massMeq,'expected net KCell loss for this source fixture');
  assert(after.gainRateMeqPerMin>=0);
  assert(Number.isFinite(after.lossRateMeqPerMin));
  assert(Number.isFinite(after.concentrationMeqPerMl));
});

test('KCell concentration responds to live cell-water volume',()=>{
  const r=createHumMod2013KCellRuntime({initialIcfvMl:20000});
  const a=r.step({
    dtSec:1,
    kPoolMassMeq:60,
    delayedAldosteroneEffect:1,
    cellWaterVolumeMl:20000,
  });
  const b=r.step({
    dtSec:1,
    kPoolMassMeq:60,
    delayedAldosteroneEffect:1,
    cellWaterVolumeMl:21000,
  });
  assert(b.concentrationMeqPerMl<a.concentrationMeqPerMl);
});

test('KCell runtime fails closed without dynamic KPool aldosterone or cell water',()=>{
  const r=createHumMod2013KCellRuntime({initialIcfvMl:20000});
  assert.throws(()=>r.step({
    dtSec:1,
    delayedAldosteroneEffect:1,
    cellWaterVolumeMl:20000,
  }),/kPoolMassMeq/);
  assert.throws(()=>r.step({
    dtSec:1,
    kPoolMassMeq:60,
    delayedAldosteroneEffect:1,
  }),/cellWaterVolumeMl/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
