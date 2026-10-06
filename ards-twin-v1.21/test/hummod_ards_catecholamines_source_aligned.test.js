'use strict';
const {
  SOURCE_CONSTANTS,poolEffects,createHumModSourceAlignedCatecholamines
}=require('../src/hummod_ards_catecholamines_source_aligned.js');
let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}

test('requires explicit ECFV',()=>{
  let threw=false;try{createHumModSourceAlignedCatecholamines();}catch(e){threw=/ecfvMl/.test(e.message);}
  assert(threw);
});
test('source target concentrations initialize exactly',()=>{
  const s=createHumModSourceAlignedCatecholamines({ecfvMl:14000}).snapshot();
  assert(Math.abs(s.nePgPerMl-SOURCE_CONSTANTS.neTargetNgPerMl*1000)<1e-9);
  assert(Math.abs(s.epiPgPerMl-SOURCE_CONSTANTS.epiTargetNgPerMl*1000)<1e-9);
});
test('alpha beta pool equations match HumMod source',()=>{
  const x=poolEffects({nePgPerMl:240,epiPgPerMl:40});
  const total=240*0.021+40*0.125;
  assert(Math.abs(x.alphaTotal-total)<1e-12);
  assert(Math.abs(x.betaTotal-total)<1e-12);
  assert(Math.abs(x.alphaEffect-Math.log10(total))<1e-12);
  assert(Math.abs(x.betaEffect-Math.log10(total))<1e-12);
});
test('higher sympathetic drive raises NE Epi and receptor-pool effects',()=>{
  const c=createHumModSourceAlignedCatecholamines({ecfvMl:14000});
  let base;for(let i=0;i<60;i++)base=c.step({dtSec:1,adrenalNerveHz:2,generalGangliaHz:1.5});
  let high=base;for(let i=0;i<60;i++)high=c.step({dtSec:1,adrenalNerveHz:6,generalGangliaHz:4});
  assert(high.nePgPerMl>base.nePgPerMl);
  assert(high.epiPgPerMl>base.epiPgPerMl);
  assert(high.alphaEffect>base.alphaEffect);
  assert(high.betaEffect>base.betaEffect);
});
test('provenance keeps official repo canonical and mirror separate',()=>{
  const s=createHumModSourceAlignedCatecholamines({ecfvMl:14000}).snapshot();
  assert(s.provenance.sourceRepository==='HumMod/hummod-standalone');
  assert(s.provenance.reproducibilityMirrorRepository==='riliescu/hummod-standalone');
});
console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
