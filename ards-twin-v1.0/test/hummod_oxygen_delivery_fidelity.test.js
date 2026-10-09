'use strict';
const {oxygenDeliveryFidelityPoint,compareFidelitySeries}=require('../src/hummod_oxygen_delivery_fidelity.js');
let p=0,f=0;function t(n,fn){try{fn();console.log('ok -',n);p++;}catch(e){console.error('FAIL -',n,':',e.message);f++;}}
function near(a,b,tol=1e-9){if(Math.abs(a-b)>tol)throw new Error(a+' not near '+b);}
t('fidelity point uses CaO2 times CO',()=>{const s=oxygenDeliveryFidelityPoint({cardiacOutputMlPerMin:5000,arterialO2ContentMlPerMl:0.2,mixedVenousO2ContentMlPerMl:0.15});near(s.globalOxygenDeliveryMlPerMin,1000);near(s.globalVenousO2ReturnMlPerMin,750);near(s.globalExtractionRatio,0.25);});
t('series comparison reports exact field-wise error',()=>{const a=[oxygenDeliveryFidelityPoint({cardiacOutputMlPerMin:5000,arterialO2ContentMlPerMl:0.2,heartRatePerMin:100})];const b=[oxygenDeliveryFidelityPoint({cardiacOutputMlPerMin:4900,arterialO2ContentMlPerMl:0.2,heartRatePerMin:110})];const c=compareFidelitySeries(a,b);near(c.maxAbsoluteError.cardiacOutputMlPerMin,100);near(c.maxAbsoluteError.heartRatePerMin,10);});
console.log('\nTests: passed='+p+' failed='+f);process.exit(f?1:0);