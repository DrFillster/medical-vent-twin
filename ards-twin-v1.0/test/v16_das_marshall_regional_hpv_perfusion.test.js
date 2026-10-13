'use strict';

const assert=require('node:assert/strict');
const {
  regionalHpvPerfusionDasMarshall,
}=require('../src/v16_das_marshall_regional_hpv_perfusion.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('equal regional oxygen produces equal regional perfusion',()=>{
  const s=regionalHpvPerfusionDasMarshall({
    totalPulmonaryBloodFlowMlPerMin:6000,
    regionalAlveolarPo2MmHg:[100,100,100],
    mixedVenousPo2MmHg:40,
    regionalIds:['a','b','c'],
  });
  for(const r of s.regions){
    assert(Math.abs(r.perfusionFraction-1/3)<1e-12);
  }
  assert(Math.abs(s.flowClosureMlPerMin)<1e-9);
});

test('regional hypoxia diverts flow away from the hypoxic region',()=>{
  const s=regionalHpvPerfusionDasMarshall({
    totalPulmonaryBloodFlowMlPerMin:6000,
    regionalAlveolarPo2MmHg:[30,100,100],
    mixedVenousPo2MmHg:40,
    regionalIds:['hypoxic','normal1','normal2'],
  });
  assert(s.regions[0].hpvResistanceCoefficient>
    s.regions[1].hpvResistanceCoefficient);
  assert(s.regions[0].perfusionFraction<
    s.regions[1].perfusionFraction);
  assert(Math.abs(s.regions[1].perfusionFraction-
    s.regions[2].perfusionFraction)<1e-12);
});

test('composition refuses missing regional alveolar oxygen state',()=>{
  assert.throws(()=>regionalHpvPerfusionDasMarshall({
    totalPulmonaryBloodFlowMlPerMin:6000,
    regionalAlveolarPo2MmHg:[],
    mixedVenousPo2MmHg:40,
  }),/non-empty array/);
});

test('composition does not accept global arterial PO2 as a substitute',()=>{
  assert.throws(()=>regionalHpvPerfusionDasMarshall({
    totalPulmonaryBloodFlowMlPerMin:6000,
    mixedVenousPo2MmHg:40,
    arterialPo2MmHg:60,
  }),/regionalAlveolarPo2MmHg/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
