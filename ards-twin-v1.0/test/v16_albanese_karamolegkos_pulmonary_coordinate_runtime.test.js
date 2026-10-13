'use strict';

const assert=require('node:assert/strict');
const {
  P,
  defaultState,
  createV16PulmonaryCoordinateRuntime,
}=require('../src/v16_albanese_karamolegkos_pulmonary_coordinate_runtime.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.stack||e.message);failed++;}
}

test('source initial state is nominal FRC with end-expiratory pressure equilibrium',()=>{
  const s=defaultState();
  assert.equal(s.Pl,0);
  assert.equal(s.Ppl,-5);
  assert.equal(s.PtrTm,5);
  assert.equal(s.PbTm,5);
  assert.equal(s.PATm,5);
  assert.equal(s.VA,2.25);
});

test('zero airway-opening pressure preserves passive source equilibrium',()=>{
  const r=createV16PulmonaryCoordinateRuntime({
    dtSec:0.0005,
    airwayOpeningPressureProvider:()=>0,
  });
  const s=r.runFor(0.02);
  assert(Math.abs(s.sourcePressureStateCmH2O.PA)<1e-10);
  assert(Math.abs(s.sourcePressureStateCmH2O.Ppl+5)<1e-10);
  assert(Math.abs(s.alveolarVolumeL-P.nominalAlveolarVolumeL)<1e-10);
});

test('positive airway pressure raises alveolar/pleural pressure and alveolar volume',()=>{
  const r=createV16PulmonaryCoordinateRuntime({
    dtSec:0.0005,
    airwayOpeningPressureProvider:()=>15,
  });
  const s=r.runFor(0.5);
  assert(s.sourcePressureStateCmH2O.PA>0);
  assert(s.sourcePressureStateCmH2O.Ppl>-5);
  assert(s.alveolarVolumeL>P.nominalAlveolarVolumeL);
  assert(s.pulmonaryVascularBoundary.sourceQualified);
  assert(Number.isFinite(s.pulmonaryVascularBoundary.alveolarPressureMmHg));
  assert(Number.isFinite(s.pulmonaryVascularBoundary.pleuralPressureMmHg));
});

test('translator never consumes Vent elastic volume',()=>{
  const r=createV16PulmonaryCoordinateRuntime({
    dtSec:0.0005,
    airwayOpeningPressureProvider:()=>10,
  });
  const s=r.step();
  assert(!Object.hasOwn(s,'ventElasticVolumeL'));
  assert(!Object.hasOwn(s.pulmonaryVascularBoundary,'ventElasticVolumeL'));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
