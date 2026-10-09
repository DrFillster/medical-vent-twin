'use strict';
const {REQUIRED_UPSTREAM_INPUTS,explicitOrganNetworkReadiness}=require('../src/hummod_explicit_organ_network_readiness.js');
let p=0,f=0;function t(n,fn){try{fn();console.log('ok -',n);p++;}catch(e){console.error('FAIL -',n,':',e.message);f++;}}
function a(v,m){if(!v)throw new Error(m||'assertion failed');}
t('explicit network remains blocked when upstream native dependencies are missing',()=>{const r=explicitOrganNetworkReadiness({});a(r.ready===false);a(r.missing.kidney.includes('tgfVascularSignal'));a(r.missing.skin.includes('skinTempC'));});
t('readiness becomes true only when every declared input is present',()=>{const all={};for(const [bed,keys] of Object.entries(REQUIRED_UPSTREAM_INPUTS)){all[bed]={};for(const k of keys)all[bed][k]=0;}const r=explicitOrganNetworkReadiness(all);a(r.ready===true);});
console.log('\nTests: passed='+p+' failed='+f);process.exit(f?1:0);