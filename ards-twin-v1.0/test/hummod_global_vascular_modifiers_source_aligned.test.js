'use strict';
const {viscosityFromHematocrit,noAnesthesiaVascularState}=require('../src/hummod_global_vascular_modifiers_source_aligned.js');
let p=0,f=0;function t(n,fn){try{fn();console.log('ok -',n);p++;}catch(e){console.error('FAIL -',n,':',e.message);f++;}}
function near(a,b,tol=1e-9){if(Math.abs(a-b)>tol)throw new Error(a+' not near '+b);}
t('native viscosity curve is neutral at Hct 0.44',()=>{const s=viscosityFromHematocrit({hematocrit:0.44});near(s.value,1);near(s.conductanceEffect,1);});
t('no-anesthesia source state is exactly neutral',()=>{const s=noAnesthesiaVascularState();near(s.vascularConductance,1);near(s.heartContractility,1);});
console.log('\nTests: passed='+p+' failed='+f);process.exit(f?1:0);