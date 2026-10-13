'use strict';

const assert=require('node:assert/strict');
const {
  createV15IntegratedCardiopulmonaryCandidate,
}=require('../src/v15_integrated_cardiopulmonary_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('integrated candidate exposes source coronary flow and myocardial O2 use',()=>{
  const c=createV15IntegratedCardiopulmonaryCandidate({dtSec:0.002});
  c.runFor(2);
  const s=c.snapshot();
  const m=s.cardiovascular.myocardialSourceState;
  assert(m);
  assert(Number.isFinite(m.coronaryBloodFlowMlPerMin));
  assert(m.coronaryBloodFlowMlPerMin>0);
  assert(Number.isFinite(m.myocardialO2UseMlPerMin));
  assert(m.myocardialO2UseMlPerMin>=0);
  assert.equal(m.conversionOnly.secondsPerMinute,60);
  assert.equal(m.conversionOnly.physiologicGainAdded,false);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
