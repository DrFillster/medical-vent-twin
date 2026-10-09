'use strict';
const {compareNativeOrganFlowSeries}=require('../src/hummod_native_organ_flow_validation.js');
let passed=0,failed=0;
function test(n,f){try{f();console.log('ok -',n);passed++;}catch(e){console.error('FAIL -',n,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
test('fails closed when a native organ bed is not ported',()=>{
  const r=compareNativeOrganFlowSeries({nativeSeries:{brain:[800,810],kidney:[1100,1000]},candidateSeries:{brain:[800,810]}});
  assert(r.passed===false);
  assert(r.organs.kidney.status==='not-ported');
});
test('passes compared series inside tolerance',()=>{
  const r=compareNativeOrganFlowSeries({nativeSeries:{fat:[240,220]},candidateSeries:{fat:[240.5,219.5]},absoluteToleranceMlPerMin:1});
  assert(r.passed===true);
});
console.log('\nTests: passed='+passed+' failed='+failed);process.exit(failed?1:0);
