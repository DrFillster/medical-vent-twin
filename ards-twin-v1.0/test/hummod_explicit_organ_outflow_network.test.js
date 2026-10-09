'use strict';
const {buildExplicitSystemicOutflow,REQUIRED_PERIPHERAL_BEDS}=require('../src/hummod_explicit_organ_outflow_network.js');
let p=0,f=0;function t(n,fn){try{fn();console.log('ok -',n);p++;}catch(e){console.error('FAIL -',n,':',e.message);f++;}}
function a(v,m){if(!v)throw new Error(m||'assertion failed');}
t('network fails closed when any HumMod bed is missing',()=>{const r=buildExplicitSystemicOutflow({peripheralBeds:{brain:800},splanchnicBeds:{giTract:1000,hepaticArtery:250}});a(!r.complete);a(r.systemicArterialOutflowMlPerMin===null);});
t('network closes only with all exact HumMod beds present',()=>{const pBeds={};for(const k of REQUIRED_PERIPHERAL_BEDS)pBeds[k]=100;const r=buildExplicitSystemicOutflow({peripheralBeds:pBeds,splanchnicBeds:{giTract:1000,hepaticArtery:250}});a(r.complete);a(r.systemicArterialOutflowMlPerMin===2350);});
console.log('\nTests: passed='+p+' failed='+f);process.exit(f?1:0);