'use strict';
const {a2PoolConcentration,createAdhPool}=require('../src/hummod_hormone_pools_source_aligned.js');
let p=0,f=0;function t(n,fn){try{fn();console.log('ok -',n);p++;}catch(e){console.error('FAIL -',n,':',e.message);f++;}}
function near(a,b,tol=1e-9){if(Math.abs(a-b)>tol)throw new Error(a+' not near '+b);}
t('A2 concentration preserves HumMod formation equation',()=>{const s=a2PoolConcentration({reninPra:2,a2PumpRate:0,blockPercent:0});near(s.ceActivity,30);near(s.endogenousRate,60);near(s.formationRate,60);near(s.pgPerMl,19.998);near(s.log10Conc,Math.log10(19.998));});
t('ADH pool initializes from target concentration and ECFV',()=>{const p=createAdhPool({ecfvInitialLiters:15});const s=p.snapshot(15);near(s.mass,30);near(s.pgPerMl,2);near(s.log10Conc,Math.log10(2));});
t('ADH pool integrates explicit source gain minus loss on minute timebase',()=>{const p=createAdhPool({ecfvInitialLiters:15});const s=p.step({dtSec:60,ecfvLiters:15,secretionRate:3,pumpRate:1,clearanceRate:2});near(s.mass,32);near(s.change,2);});
console.log('\nTests: passed='+p+' failed='+f);process.exit(f?1:0);
