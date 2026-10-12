'use strict';

const assert=require('node:assert/strict');
const {
  createUrsinoMagossoGasCardiovascularShadow,
}=require('../src/ursino_magosso_gas_cardiovascular_shadow.js');
const {
  createUrsinoMagossoGasCardiovascularCandidate,
}=require('../src/ursino_magosso_gas_cardiovascular_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function close(a,b,tol=1e-12){
  return Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b));
}

test('promotion changes authority but not source-family physiology',()=>{
  const shadow=createUrsinoMagossoGasCardiovascularShadow();
  const candidate=createUrsinoMagossoGasCardiovascularCandidate();

  let a,b;
  const sequence=[
    {seconds:30,pao2MmHg:100,paco2MmHg:40,tidalVolumeL:0.5,systemicArterialPressureMmHg:92},
    {seconds:30,pao2MmHg:50,paco2MmHg:40,tidalVolumeL:0.5,systemicArterialPressureMmHg:92},
    {seconds:30,pao2MmHg:100,paco2MmHg:60,tidalVolumeL:0.5,systemicArterialPressureMmHg:92},
    {seconds:30,pao2MmHg:50,paco2MmHg:60,tidalVolumeL:0.5,systemicArterialPressureMmHg:92},
  ];

  for(const phase of sequence){
    for(let t=0;t<phase.seconds;t+=0.2){
      const input={
        dtSec:0.2,
        systemicArterialPressureMmHg:phase.systemicArterialPressureMmHg,
        pao2MmHg:phase.pao2MmHg,
        paco2MmHg:phase.paco2MmHg,
        tidalVolumeL:phase.tidalVolumeL,
      };
      a=shadow.step(input);
      b=candidate.step(input);
    }

    for(const key of ['fAbSpikesPerSec','fAcSpikesPerSec','fApSpikesPerSec']){
      assert(close(a.afferents[key],b.afferents[key]),key);
    }
    for(const key of [
      'fSpSpikesPerSec','fSvSpikesPerSec','fShSpikesPerSec','fVSpikesPerSec',
      'thetaSp','thetaSv','thetaSh',
    ]){
      assert(close(a.autonomic[key],b.autonomic[key]),key);
    }
    for(const key of [
      'EmaxLv','EmaxRv','Rsp','Rep','Vusv','Vuev','heartPeriodSec',
    ]){
      assert(close(a.effectors[key],b.effectors[key]),key);
    }
    assert(close(a.candidateHeartRatePerMin,b.candidateHeartRatePerMin));
  }

  assert.equal(a.authority,'shadow-diagnostic-only');
  assert.equal(a.controlAuthority,false);
  assert.equal(b.authority,'candidate-not-canonical');
  assert.equal(b.canonicalControlAuthority,false);
  assert.equal(b.candidatePlantControlAuthority,true);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
