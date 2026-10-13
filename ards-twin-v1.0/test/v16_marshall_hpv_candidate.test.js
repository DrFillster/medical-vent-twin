'use strict';

const assert=require('node:assert/strict');
const {
  MAX_PVR_RATIO,
  marshallStimulusPo2MmHg,
  marshallHpvResponseFraction,
  dasHpvResistanceCoefficientFromMarshall,
}=require('../src/v16_marshall_hpv_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('Marshall stimulus preserves published geometric oxygen weighting',()=>{
  const s=marshallStimulusPo2MmHg({
    alveolarPo2MmHg:40,
    mixedVenousPo2MmHg:40,
  });
  assert(Math.abs(s-40)<1e-12);
});

test('HPV response rises as alveolar oxygen tension falls',()=>{
  const high=marshallHpvResponseFraction({
    alveolarPo2MmHg:100,
    mixedVenousPo2MmHg:40,
  });
  const low=marshallHpvResponseFraction({
    alveolarPo2MmHg:30,
    mixedVenousPo2MmHg:40,
  });
  assert(low.responseFraction>high.responseFraction);
});

test('Das resistance coefficient is bounded by source baseline and max ratio',()=>{
  const s=dasHpvResistanceCoefficientFromMarshall({
    alveolarPo2MmHg:30,
    mixedVenousPo2MmHg:40,
  });
  assert(s.hpvCoefficient>=1);
  assert(s.hpvCoefficient<=MAX_PVR_RATIO);
});

test('candidate rejects nonpositive oxygen tensions rather than extrapolating',()=>{
  assert.throws(()=>dasHpvResistanceCoefficientFromMarshall({
    alveolarPo2MmHg:0,
    mixedVenousPo2MmHg:40,
  }),/alveolarPo2MmHg/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
