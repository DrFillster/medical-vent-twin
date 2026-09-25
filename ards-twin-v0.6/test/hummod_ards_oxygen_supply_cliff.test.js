'use strict';

const {
  criticalExtractionRatioForPaco2,
  evaluateOxygenSupplyCliff,
} = require('../src/hummod_ards_oxygen_supply_cliff.js');

let passed=0, failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}
function near(a,b,tol=1e-9){assert(Math.abs(a-b)<=tol,a+' != '+b);}

test('moderate hypercapnia preserves normocapnic extraction anchor',()=>{
  near(criticalExtractionRatioForPaco2(40),0.72);
  near(criticalExtractionRatioForPaco2(72),0.72);
});

test('severe hypercapnia lowers critical extraction to published anchor',()=>{
  near(criticalExtractionRatioForPaco2(118),0.54);
  near(criticalExtractionRatioForPaco2(200),0.54);
});

test('severe hypercapnia moves the oxygen-delivery cliff upward at fixed demand',()=>{
  const normal=evaluateOxygenSupplyCliff({
    cardiacOutputMlPerMin:2500,
    arterialO2ContentMlPerMl:0.15,
    requestedTissueO2UseMlPerMin:250,
    arterialPco2MmHg:40,
    physicalMaxAerobicO2UseMlPerMin:1000,
  });
  const severe=evaluateOxygenSupplyCliff({
    cardiacOutputMlPerMin:2500,
    arterialO2ContentMlPerMl:0.15,
    requestedTissueO2UseMlPerMin:250,
    arterialPco2MmHg:118,
    physicalMaxAerobicO2UseMlPerMin:1000,
  });
  assert(severe.criticalOxygenDeliveryMlPerMin>
    normal.criticalOxygenDeliveryMlPerMin,
    'severe hypercapnia must increase DO2crit');
  assert(severe.actualTissueO2UseMlPerMin<
    normal.actualTissueO2UseMlPerMin,
    'same DO2 should support less aerobic VO2 under severe hypercapnia');
  assert(severe.supplyDependent===true,
    'severe hypercapnia should cross the cliff in this fixed challenge');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
