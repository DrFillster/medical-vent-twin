'use strict';

const {
  createV23OxygenDeficitState,
}=require('../src/v23_oxygen_deficit_state.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}
function near(a,b,t=1e-9){assert(Math.abs(a-b)<=t,a+' != '+b);}

test('adequate delivery accumulates no oxygen deficit',()=>{
  const s=createV23OxygenDeficitState();
  let x;
  for(let i=0;i<60;i++) x=s.step({
    dtSec:1,
    requestedTissueO2UseMlPerMin:250,
    actualTissueO2UseMlPerMin:250,
    oxygenDeliveryMlPerMin:800,
    criticalOxygenDeliveryMlPerMin:350,
    deliveryToCriticalRatio:800/350,
  });
  near(x.cumulativeOxygenDeficitMl,0);
  near(x.cumulativeFractionalDeficitMin,0);
  near(x.timeSupplyDependentSec,0);
  assert(x.failureAuthority===false&&x.arrestAuthority===false);
});

test('unmet aerobic demand integrates exactly in mL O2',()=>{
  const s=createV23OxygenDeficitState();
  let x;
  for(let i=0;i<120;i++) x=s.step({
    dtSec:1,
    requestedTissueO2UseMlPerMin:250,
    actualTissueO2UseMlPerMin:200,
    oxygenDeliveryMlPerMin:300,
    criticalOxygenDeliveryMlPerMin:350,
    deliveryToCriticalRatio:300/350,
  });
  near(x.oxygenSupplyDeficitMlPerMin,50);
  near(x.cumulativeOxygenDeficitMl,100);
  near(x.cumulativeFractionalDeficitMin,0.4);
  near(x.timeSupplyDependentSec,120);
  near(x.timeBelowCriticalSec,120);
});

test('state does not convert debt to universal failure authority',()=>{
  const s=createV23OxygenDeficitState();
  const x=s.step({
    dtSec:3600,
    requestedTissueO2UseMlPerMin:250,
    actualTissueO2UseMlPerMin:0,
    oxygenDeliveryMlPerMin:0,
    criticalOxygenDeliveryMlPerMin:350,
    deliveryToCriticalRatio:0,
  });
  assert(x.cumulativeOxygenDeficitMl===15000);
  assert(x.failureAuthority===false);
  assert(x.arrestAuthority===false);
  assert(x.contractilityAuthority===false);
  assert(x.lactateAuthority===false);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
