'use strict';

const assert=require('node:assert/strict');
const {
  validateBoundary,
  createV16KaramolegkosPulmonaryVascularRuntime,
}=require('../src/v16_karamolegkos_pulmonary_vascular_runtime.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.stack||e.message);failed++;}
}

const qualifiedBoundary=()=>Object.freeze({
  sourceQualified:true,
  alveolarVolumeL:2.25,
  alveolarPressureMmHg:0,
  pleuralPressureMmHg:-3,
  rvOutflowMlPerSec:80,
  leftAtrialPressureMmHg:5,
  shuntFraction:0.05,
  capillaryResistanceMmHgSecPerMl:0.04,
  provenance:Object.freeze({
    fixture:'focused source-coordinate validation only',
    canonical:false,
  }),
});

test('boundary contract fails closed without source qualification',()=>{
  assert.throws(()=>validateBoundary({
    ...qualifiedBoundary(),
    sourceQualified:false,
  }),/source-qualified/);
});

test('source-native pulmonary vascular runtime advances finite state',()=>{
  const runtime=createV16KaramolegkosPulmonaryVascularRuntime({
    dtSec:0.0005,
    initialState:{
      PpaTm:18,
      Fpa:80,
      PpalTm:13,
      PpcTm:9,
      PpvTm:10,
    },
    boundaryProvider:qualifiedBoundary,
  });
  const s=runtime.runFor(0.05);
  assert.equal(s.schema,'v16-karamolegkos-pulmonary-vascular-runtime/v1');
  assert.equal(s.canonicalControlAuthority,false);
  for(const value of Object.values(s.state)) assert(Number.isFinite(value));
  for(const value of Object.values(s.pressuresMmHg)) assert(Number.isFinite(value));
  for(const value of Object.values(s.flowsMlPerSec)) assert(Number.isFinite(value));
  assert(s.flowsMlPerSec.nonShuntArteriolar>0);
  assert(s.flowsMlPerSec.shunt>=0);
  assert(s.flowsMlPerSec.capillary>0);
  assert(s.flowsMlPerSec.pulmonaryVein>0);
  assert(s.pulmonaryArteriolarResistanceMmHgSecPerMl>0);
});

test('gas-perfusion export is sourced from pulmonary runtime state',()=>{
  const runtime=createV16KaramolegkosPulmonaryVascularRuntime({
    dtSec:0.0005,
    initialState:{
      PpaTm:18,
      Fpa:80,
      PpalTm:13,
      PpcTm:9,
      PpvTm:10,
    },
    boundaryProvider:qualifiedBoundary,
  });
  const s=runtime.step();
  assert.equal(s.pulmonaryPerfusionState.sourceQualified,true);
  assert(s.pulmonaryPerfusionState.totalPulmonaryBloodFlowMlPerMin>0);
  assert(s.pulmonaryPerfusionState.ventilatedPulmonaryBloodFlowMlPerMin>0);
  assert.equal(s.pulmonaryPerfusionState.shuntFraction,0.05);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
