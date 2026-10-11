'use strict';

const assert=require('node:assert/strict');
const {
  SOURCE,P,co2InteractionK,peripheralChemoreceptorStatic,
  cnsHypoxiaStatic,sympatheticFiring,createMagossoUrsinoGasAutonomicCandidate,
}=require('../src/magosso_ursino_2001_gas_autonomic_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function close(a,b,tol=1e-12){return Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b));}

test('primary source identity and equation set are pinned',()=>{
  assert.equal(SOURCE.doi,'10.1152/ajpheart.2001.281.5.H2036');
  assert.deepEqual(SOURCE.equations,[1,2,3,4,5,6,7]);
  assert.equal(P.chemoreceptor.fMaxSpikesPerSec,12.3);
  assert.equal(P.chemoreceptor.fMinSpikesPerSec,0.835);
  assert.equal(P.chemoreceptor.kHigh,3);
  assert.equal(P.chemoreceptor.paco2NormalMmHg,40);
});

test('Eq 1 K branches preserve printed source values',()=>{
  assert.equal(co2InteractionK(81),3);
  assert(close(co2InteractionK(80),3));
  assert(close(co2InteractionK(60),3.8));
  assert(close(co2InteractionK(40),4.6));
  assert(close(co2InteractionK(39.9),1.4));
});

test('Eq 1 CO2 term increases chemoreceptor target at fixed oxygen in normoxic branch',()=>{
  const low=peripheralChemoreceptorStatic({pao2MmHg:90,paco2MmHg:35});
  const high=peripheralChemoreceptorStatic({pao2MmHg:90,paco2MmHg:50});
  assert(high>low);
});

test('Eq 4 CNS hypoxia response increases as PaO2 falls',()=>{
  for(const channel of ['p','v','h']){
    assert(cnsHypoxiaStatic(20,channel)>cnsHypoxiaStatic(80,channel));
  }
});

test('Eq 3 cardiac sympathetic output rises when cardiac theta falls',()=>{
  const common={channel:'h',fAbSpikesPerSec:25,fAcSpikesPerSec:5,fApSpikesPerSec:10};
  const normal=sympatheticFiring({...common,thetaSpikesPerSec:3.6});
  const stressed=sympatheticFiring({...common,thetaSpikesPerSec:-5});
  assert(stressed>normal);
});

test('dynamic candidate exposes distinct cardiac, vascular, and venous channels',()=>{
  const c=createMagossoUrsinoGasAutonomicCandidate();
  const s=c.step({
    dtSec:1,pao2MmHg:60,paco2MmHg:50,
    fAbSpikesPerSec:25,fApSpikesPerSec:10,
  });
  for(const k of ['fSpSpikesPerSec','fSvSpikesPerSec','fShSpikesPerSec']){
    assert(Number.isFinite(s[k]),k+' missing');
  }
  assert.equal(s.authority,'candidate-not-canonical');
});

test('hypercapnia drives direct CNS cardiac CO2 offset with source gain',()=>{
  const c=createMagossoUrsinoGasAutonomicCandidate();
  const s=c.step({
    dtSec:1,pao2MmHg:90,paco2MmHg:50,
    fAbSpikesPerSec:25,fApSpikesPerSec:10,
  });
  assert(s.deltaThetaCo2Sh>0);
  assert(close(s.deltaThetaCo2Sv,0));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
