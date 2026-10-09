'use strict';
const {sourceAlignedSystemicOutflow}=require('../src/hummod_systemic_outflow_source_aligned.js');
let passed=0,failed=0;
function test(n,f){try{f();console.log('ok -',n);passed++;}catch(e){console.error('FAIL -',n,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function near(a,b,t=1e-9){if(Math.abs(a-b)>t)throw new Error(a+' not near '+b);}
test('reproduces HumMod systemic arterial outflow composition',()=>{
  const s=sourceAlignedSystemicOutflow({
    peripheralFlowsMlPerMin:{avFistula:0,bone:420,brain:820,fat:240,kidney:1200,leftHeart:190,
      otherTissue:380,respiratoryMuscle:100,rightHeart:40,skeletalMuscle:650,skin:140},
    splanchnicFlowsMlPerMin:{giTract:1000,hepaticArtery:250},
  });
  near(s.peripheralFlowMlPerMin,4180);
  near(s.hepaticVeinFlowMlPerMin,1250);
  near(s.systemicArterialOutflowMlPerMin,5430);
  assert(s.derivedPeripheralResistance===null);
  assert(s.provenance.tprUsedAsFlowDriver===false);
});
console.log('\nTests: passed='+passed+' failed='+failed);process.exit(failed?1:0);
