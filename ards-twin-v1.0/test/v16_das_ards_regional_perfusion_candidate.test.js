'use strict';

const assert=require('node:assert/strict');
const {
  defaultRegionalResistanceDas2015,
  regionalPerfusionWeightsDas2015,
  allocateRegionalPulmonaryFlowDas2015,
}=require('../src/v16_das_ards_regional_perfusion_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('Das Eq 24 preserves RV0 = 160 * N_A',()=>{
  assert.equal(defaultRegionalResistanceDas2015({regionCount:100}),16000);
  assert.equal(defaultRegionalResistanceDas2015({regionCount:3}),480);
});

test('parallel equal-resistance regions split perfusion equally',()=>{
  const s=regionalPerfusionWeightsDas2015({
    hpvCoefficients:[1,1,1],
    sourceQualified:true,
  });
  assert(Math.abs(s.totalPvrDynSecCm5Min-160)<1e-12);
  for(const f of s.perfusionFractions){
    assert(Math.abs(f-1/3)<1e-12);
  }
});

test('higher HPV coefficient reduces regional perfusion',()=>{
  const s=regionalPerfusionWeightsDas2015({
    hpvCoefficients:[1,2,4],
    sourceQualified:true,
  });
  assert(s.perfusionFractions[0]>s.perfusionFractions[1]);
  assert(s.perfusionFractions[1]>s.perfusionFractions[2]);
});

test('regional allocation conserves total pulmonary flow',()=>{
  const s=allocateRegionalPulmonaryFlowDas2015({
    totalPulmonaryBloodFlowMlPerMin:5000,
    hpvCoefficients:[1,2,4],
    sourceQualified:true,
  });
  assert(Math.abs(s.flowClosureMlPerMin)<1e-9);
});

test('candidate refuses unsourced HPV coefficients',()=>{
  assert.throws(()=>regionalPerfusionWeightsDas2015({
    hpvCoefficients:[1,1,1],
    sourceQualified:false,
  }),/source-qualified/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
