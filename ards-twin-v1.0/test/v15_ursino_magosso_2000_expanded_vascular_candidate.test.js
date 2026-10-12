'use strict';

const assert=require('node:assert/strict');
const {
  SOURCE,VASCULAR,
  aggregateExtrasplanchnicBasal,
  systemicPeripheralPressureDerivative,
  venousPressureDerivatives,
  extrasplanchnicVenousPressureMmHg,
  reconstructedTotalBloodVolumeMl,
}=require('../src/ursino_magosso_2000_expanded_vascular_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function close(a,b,tol=1e-9){
  return Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b));
}

test('primary source identity and Table 1 values are pinned',()=>{
  assert.equal(SOURCE.doi,'10.1152/ajpheart.2000.279.1.H149');
  assert.equal(SOURCE.authority,'candidate-not-canonical');
  assert.equal(VASCULAR.ep.C,0.668);
  assert.equal(VASCULAR.mp.R,4.48);
  assert.equal(VASCULAR.bp.R,6.57);
  assert.equal(VASCULAR.hp.R,19.71);
  assert.equal(VASCULAR.ev.Vu,550);
  assert.equal(VASCULAR.mv.Vu,432.14);
  assert.equal(VASCULAR.bv.Vu,294.64);
  assert.equal(VASCULAR.hv.Vu,98.21);
});

test('expanded extrasplanchnic split reproduces prior aggregate basal properties',()=>{
  const a=aggregateExtrasplanchnicBasal();
  assert(close(a.peripheralComplianceMlPerMmHg,1.67,1e-3));
  assert(close(a.peripheralUnstressedVolumeMl,336.6,1e-3));
  assert(close(a.peripheralResistanceMmHgSecPerMl,1.407,2e-3));
  assert(close(a.venousComplianceMlPerMmHg,50.0,1e-3));
  assert(close(a.venousUnstressedVolumeMl,1375,1e-3));
  assert(close(a.venousResistanceMmHgSecPerMl,0.016,2e-3));
});

test('Eq 12 algebraic Pev exactly closes total blood volume',()=>{
  const state={
    Psa:92,Psp:80,Psv:10,Pmv:8,Pbv:8,Phv:8,Pra:3,
    Vrv:80,Ppa:15,Ppp:10,Ppv:7,Pla:5,Vlv:120,
  };
  const Pev=extrasplanchnicVenousPressureMmHg(state);
  const V=reconstructedTotalBloodVolumeMl({...state,Pev});
  assert(close(V,VASCULAR.totalBloodVolumeMl,1e-12));
});

test('Eqs 7-11 return finite derivatives at a finite state',()=>{
  const dPsp=systemicPeripheralPressureDerivative({
    Fsa:80,Psp:80,Psv:10,Pev:8,Pmv:8,Pbv:8,Phv:8,
  });
  const veins=venousPressureDerivatives({
    Psp:80,Psv:10,Pmv:8,Pbv:8,Phv:8,Pra:3,
  });
  assert(Number.isFinite(dPsp));
  for(const v of Object.values(veins)) assert(Number.isFinite(v));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
