'use strict';

const assert=require('node:assert/strict');
const {
  SOURCE,standardSaturationFromPo2,standardPo2FromSaturation,
  protocolMappingFromReportedSaO2,
}=require('../src/severinghaus_1979_standard_odc_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('source and authority are pinned',()=>{
  assert.equal(SOURCE.doi,'10.1152/jappl.1979.46.3.599');
  assert.deepEqual(SOURCE.equations,[1,2]);
  assert.equal(SOURCE.authority,'candidate-not-canonical');
});

test('Eq1 saturation is monotonic over physiologic PO2 range',()=>{
  let prior=0;
  for(const p of [20,30,40,50,60,80,100,150]){
    const s=standardSaturationFromPo2(p);
    assert(s>prior);
    assert(s>0&&s<1);
    prior=s;
  }
});

test('Eq1 and Eq2 are mutually consistent across useful saturation range',()=>{
  for(const s of [0.50,0.70,0.80,0.85,0.90,0.95,0.98]){
    const p=standardPo2FromSaturation(s);
    const roundTrip=standardSaturationFromPo2(p);
    assert(Math.abs(roundTrip-s)<0.01,'round trip '+s+' -> '+roundTrip);
  }
});

test('study SaO2 mapping remains explicitly approximate and non-canonical',()=>{
  const m=protocolMappingFromReportedSaO2({
    reportedSaO2Fraction:0.85,
    sourceProtocol:'healthy-volunteer isocapnic hypoxia',
  });
  assert(Number.isFinite(m.standardCurvePaO2MmHg));
  assert.equal(m.exactProtocolMatch,false);
  assert.equal(m.mappingAuthority,'candidate-protocol-approximation-only');
  assert(m.limitations.length>=5);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
