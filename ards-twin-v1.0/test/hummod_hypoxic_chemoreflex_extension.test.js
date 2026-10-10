'use strict';
const {hypoxicSympsChemoEffect}=require('../src/hummod_hypoxic_chemoreflex_extension.js');

let p=0,f=0;
function t(n,fn){try{fn();console.log('ok -',n);p++;}catch(e){console.error('FAIL -',n,':',e.message);f++;}}
function near(a,b,tol=1e-12){if(Math.abs(a-b)>tol)throw new Error(a+' not near '+b);}

t('extension is neutral at and above PaO2 70',()=>{
  near(hypoxicSympsChemoEffect({arterialPo2MmHg:90}).effect,1);
  near(hypoxicSympsChemoEffect({arterialPo2MmHg:70}).effect,1);
});
t('extension is half activated at PaO2 55',()=>{
  const s=hypoxicSympsChemoEffect({arterialPo2MmHg:55});
  near(s.drive,0.5); near(s.effect,1.5);
});
t('extension is capped at HumMod display maximum by PaO2 40',()=>{
  near(hypoxicSympsChemoEffect({arterialPo2MmHg:40}).effect,2);
  near(hypoxicSympsChemoEffect({arterialPo2MmHg:15}).effect,2);
});
t('extension never claims direct HR authority',()=>{
  const s=hypoxicSympsChemoEffect({arterialPo2MmHg:40});
  if(s.provenance.directHeartRateGain!==false) throw new Error('must not drive HR directly');
  if(s.provenance.nativeHumModEquation!==false) throw new Error('must remain labeled extension');
});

console.log('\nTests: passed='+p+' failed='+f);
process.exit(f?1:0);
