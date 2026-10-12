'use strict';

const assert=require('node:assert/strict');
const {
  createUrsinoMagossoGasCardiovascularShadow,
}=require('../src/ursino_magosso_gas_cardiovascular_shadow.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

function runSteady(inputs,seconds=120,dtSec=0.2){
  const x=createUrsinoMagossoGasCardiovascularShadow();
  let s;
  for(let t=0;t<seconds;t+=dtSec){
    s=x.step({dtSec,...inputs});
  }
  return {x,s};
}

test('composed source-family shadow stays finite and non-canonical',()=>{
  const {s}=runSteady({
    systemicArterialPressureMmHg:92,
    pao2MmHg:100,
    paco2MmHg:40,
    tidalVolumeL:0.5,
  },30);

  for(const v of [
    s.afferents.fAbSpikesPerSec,
    s.afferents.fAcSpikesPerSec,
    s.afferents.fApSpikesPerSec,
    s.autonomic.fSpSpikesPerSec,
    s.autonomic.fSvSpikesPerSec,
    s.autonomic.fShSpikesPerSec,
    s.autonomic.fVSpikesPerSec,
    s.effectors.EmaxLv,
    s.effectors.EmaxRv,
    s.effectors.Rsp,
    s.effectors.Rep,
    s.effectors.Vusv,
    s.effectors.Vuev,
    s.effectors.heartPeriodSec,
    s.candidateHeartRatePerMin,
  ]) assert(Number.isFinite(v));

  assert.equal(s.authority,'shadow-diagnostic-only');
  assert.equal(s.controlAuthority,false);
});

test('isolated hypoxia propagates through chemoreflex/CNS channels into effectors',()=>{
  const base=runSteady({
    systemicArterialPressureMmHg:92,
    pao2MmHg:100,
    paco2MmHg:40,
    tidalVolumeL:0.5,
  }).x;

  let before=base.snapshot();
  let after;
  for(let t=0;t<60;t+=0.2){
    after=base.step({
      dtSec:0.2,
      systemicArterialPressureMmHg:92,
      pao2MmHg:28,
      paco2MmHg:40,
      tidalVolumeL:0.5,
    });
  }

  assert(after.afferents.fAcSpikesPerSec>before.afferents.fAcSpikesPerSec);
  assert(after.autonomic.fSpSpikesPerSec!==before.autonomic.fSpSpikesPerSec);
  assert(after.autonomic.fShSpikesPerSec!==before.autonomic.fShSpikesPerSec);
  assert(after.effectors.heartPeriodSec!==before.effectors.heartPeriodSec);
  assert.equal(after.controlAuthority,false);
});

test('isolated hypercapnia changes CO2-aware autonomic state without direct HR gain',()=>{
  const base=runSteady({
    systemicArterialPressureMmHg:92,
    pao2MmHg:100,
    paco2MmHg:40,
    tidalVolumeL:0.5,
  }).x;

  const before=base.snapshot();
  let after;
  for(let t=0;t<60;t+=0.2){
    after=base.step({
      dtSec:0.2,
      systemicArterialPressureMmHg:92,
      pao2MmHg:100,
      paco2MmHg:50,
      tidalVolumeL:0.5,
    });
  }

  assert(after.afferents.fAcSpikesPerSec>before.afferents.fAcSpikesPerSec);
  assert(after.autonomic.thetaSh<before.autonomic.thetaSh);
  assert(after.autonomic.fVSpikesPerSec!==before.autonomic.fVSpikesPerSec);
  assert(after.effectors.heartPeriodSec!==before.effectors.heartPeriodSec);
  assert.equal(after.controlAuthority,false);
});

test('pressure input changes the source baroreceptor afferent rather than using HumMod mapping',()=>{
  const shadow=createUrsinoMagossoGasCardiovascularShadow();
  const low=shadow.step({
    dtSec:1,
    systemicArterialPressureMmHg:70,
    pao2MmHg:100,
    paco2MmHg:40,
    tidalVolumeL:0.5,
  });
  let high=low;
  for(let i=0;i<20;i++){
    high=shadow.step({
      dtSec:1,
      systemicArterialPressureMmHg:110,
      pao2MmHg:100,
      paco2MmHg:40,
      tidalVolumeL:0.5,
    });
  }
  assert(high.afferents.fAbSpikesPerSec>low.afferents.fAbSpikesPerSec);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
