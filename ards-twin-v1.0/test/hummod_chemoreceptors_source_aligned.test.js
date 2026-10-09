'use strict';
const {createHumModChemoreceptors}=require('../src/hummod_chemoreceptors_source_aligned.js');
let p=0,f=0;function t(n,fn){try{fn();console.log('ok -',n);p++;}catch(e){console.error('FAIL -',n,':',e.message);f++;}}
function a(v,m){if(!v)throw new Error(m||'assertion failed');}
t('native chemoreceptor signal rises sharply with hypoxemia',()=>{const c1=createHumModChemoreceptors();const n=c1.step({dtSec:1,arterialPo2MmHg:94,arterialPh:7.44,gangliaGeneralHz:1.5,alphaPoolEffect:1});const c2=createHumModChemoreceptors();const h=c2.step({dtSec:1,arterialPo2MmHg:30,arterialPh:7.20,gangliaGeneralHz:1.5,alphaPoolEffect:1});a(h.basicFiringRate>n.basicFiringRate*5);a(h.po2Effect===10);});
t('pinned SympsChemo remains diagnostic-only',()=>{const c=createHumModChemoreceptors();const s=c.step({dtSec:1,arterialPo2MmHg:40,arterialPh:7.2,gangliaGeneralHz:2,alphaPoolEffect:1});a(s.provenance.sympsChemoEffectInPinnedSource===1);a(s.provenance.drivesSympsCnsInBrowser===false);});
console.log('\nTests: passed='+p+' failed='+f);process.exit(f?1:0);