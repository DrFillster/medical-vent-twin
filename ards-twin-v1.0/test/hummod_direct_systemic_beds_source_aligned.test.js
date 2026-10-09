'use strict';
const {hepaticArteryFlow,avFistulaFlow}=require('../src/hummod_direct_systemic_beds_source_aligned.js');
let p=0,f=0;function t(n,fn){try{fn();console.log('ok -',n);p++;}catch(e){console.error('FAIL -',n,':',e.message);f++;}}
function a(v,m){if(!v)throw new Error(m||'assertion failed');}function near(x,y,tol=1e-9){if(Math.abs(x-y)>tol)throw new Error(x+' not near '+y);}
t('hepatic artery uses native fixed conductance',()=>{const s=hepaticArteryFlow({systemicArterialPressureMmHg:100,splanchnicVenousPressureMmHg:10});near(s.bloodFlowMlPerMin,252);});
t('AV fistula defaults closed exactly as HumMod source',()=>{const s=avFistulaFlow({systemicArterialPressureMmHg:100,systemicVenousPressureMmHg:5,plasmaVolumeFraction:0.56});near(s.bloodFlowMlPerMin,0);near(s.conductance,0);});
console.log('\nTests: passed='+p+' failed='+f);process.exit(f?1:0);