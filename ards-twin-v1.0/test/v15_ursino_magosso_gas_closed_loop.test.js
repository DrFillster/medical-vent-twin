'use strict';

const assert=require('node:assert/strict');
const {
  createGasCardiovascularClosedLoopShadow,
}=require('../src/ursino_magosso_gas_closed_loop_shadow.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('gas-cardiovascular candidate remains non-canonical',()=>{
  const r=createGasCardiovascularClosedLoopShadow({dtSec:0.002});
  const s=r.step();
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.controlAuthority,false);
  assert.equal(s.effectorOwnership.mode,'external-source-family');
});

test('external source-family coupling carries finite Vuev derivative',()=>{
  const r=createGasCardiovascularClosedLoopShadow({dtSec:0.002});
  const s=r.step();
  assert(s.gasAutonomic);
  assert(Number.isFinite(s.gasAutonomic.effectorRate.Vuev));
  assert(Number.isFinite(
    s.effectorOwnership.external.dVuevDtMlPerSec
  ));
});

test('closed loop advances finite hemodynamics under nominal gases',()=>{
  const r=createGasCardiovascularClosedLoopShadow({dtSec:0.002});
  const s=r.runFor(1);
  for(const key of [
    'heartRatePerMin','systemicArterialPressureMmHg',
    'leftVentricleOutflowMlPerSec','EmaxLvMmHgPerMl',
    'splanchnicResistanceMmHgSecPerMl',
    'extrasplanchnicVenousUnstressedVolumeMl',
  ]){
    assert(Number.isFinite(s.hemodynamics[key]),key);
  }
});

test('gas environment changes do not create canonical authority',()=>{
  const r=createGasCardiovascularClosedLoopShadow({dtSec:0.002});
  r.runFor(1);
  r.setEnvironment({pao2MmHg:50,paco2MmHg:60});
  const s=r.runFor(1);
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.controlAuthority,false);
  assert.equal(s.environment.pao2MmHg,50);
  assert.equal(s.environment.paco2MmHg,60);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
