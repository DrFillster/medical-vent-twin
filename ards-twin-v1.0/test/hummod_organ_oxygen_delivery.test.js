'use strict';
const {
  organOxygenDelivery,
  auditOrganFlowState,
  aggregateOrganOxygenDelivery,
}=require('../src/hummod_organ_oxygen_delivery.js');

let p=0,f=0;
function t(n,fn){try{fn();console.log('ok -',n);p++;}catch(e){console.error('FAIL -',n,':',e.message);f++;}}
function near(a,b,tol=1e-9){if(Math.abs(a-b)>tol)throw new Error(a+' not near '+b);}

t('organ DO2 is flow times CaO2 and closes oxygen mass balance',()=>{
  const s=organOxygenDelivery({
    bloodFlowMlPerMin:1000,
    arterialO2ContentMlPerMl:0.20,
    o2UseMlPerMin:50,
    tissueO2ContentMlPerMl:0.15,
    tissuePo2MmHg:30,
  });
  near(s.oxygenDeliveryMlPerMin,200);
  near(s.venousO2OutflowMlPerMin,150);
  near(s.oxygenExtractionMlPerMin,50);
  near(s.extractionRatio,0.25);
  near(s.massBalanceResidualMlPerMin,0);
});

t('flow-state audit exposes existing HumMod tissue oxygen relation without changing it',()=>{
  const s=auditOrganFlowState({
    bloodFlowMlPerMin:500,
    o2UseMlPerMin:20,
    tissueO2ContentMlPerMl:0.16,
    po2MmHg:28,
  },{arterialO2ContentMlPerMl:0.20});
  near(s.oxygenDeliveryMlPerMin,100);
  near(s.venousO2OutflowMlPerMin,80);
  near(s.massBalanceResidualMlPerMin,0);
});

t('aggregate oxygen accounting sums organ delivery and use',()=>{
  const a=aggregateOrganOxygenDelivery({
    one:{bloodFlowMlPerMin:500,arterialO2ContentMlPerMl:0.2,o2UseMlPerMin:20,tissueO2ContentMlPerMl:0.16},
    two:{bloodFlowMlPerMin:1000,arterialO2ContentMlPerMl:0.2,o2UseMlPerMin:40,tissueO2ContentMlPerMl:0.16},
  });
  near(a.totalBloodFlowMlPerMin,1500);
  near(a.totalOxygenDeliveryMlPerMin,300);
  near(a.totalO2UseMlPerMin,60);
  near(a.totalMassBalanceResidualMlPerMin,0);
});

console.log('\nTests: passed='+p+' failed='+f);
process.exit(f?1:0);
