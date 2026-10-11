'use strict';

const assert=require('node:assert/strict');
const {createCanonicalHrCandidate,SOURCE}=
  require('../src/canonical_hr_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

function runConstant({map=95,pao2=95,paco2=40,vt=0.5,duration=60}={}){
  const c=createCanonicalHrCandidate();
  let s=null;
  for(let t=0;t<=duration;t+=0.1){
    s=c.step({
      timeSec:t,
      meanArterialPressureMmHg:map,
      pao2MmHg:pao2,
      paco2MmHg:paco2,
      tidalVolumeL:vt,
    });
  }
  return s;
}

test('candidate has no HumMod dependency in its source contract',()=>{
  assert.equal(SOURCE.authority,'candidate-not-canonical');
  assert.equal(Object.keys(SOURCE).some(k=>/hummod/i.test(k)),false);
});

test('candidate emits one finite HR plus source autonomic channels',()=>{
  const s=runConstant();
  for(const k of [
    'heartRatePerMin','heartPeriodSec','fAbSpikesPerSec',
    'fAcSpikesPerSec','fApSpikesPerSec','fShSpikesPerSec',
    'fSpSpikesPerSec','fSvSpikesPerSec','fVSpikesPerSec'
  ]){
    assert(Number.isFinite(s[k]),k+' must be finite');
  }
  assert(s.heartRatePerMin>0);
});

test('severe isocapnic hypoxia changes candidate HR through source chain',()=>{
  const normal=runConstant({pao2:95,paco2:40});
  const hypoxic=runConstant({pao2:45,paco2:40});
  assert.notEqual(hypoxic.heartRatePerMin,normal.heartRatePerMin);
  assert(hypoxic.fAcSpikesPerSec>normal.fAcSpikesPerSec);
});

test('normoxic hypercapnia changes candidate HR through CO2 source paths',()=>{
  const normal=runConstant({pao2:95,paco2:40});
  const hyper=runConstant({pao2:95,paco2:55});
  assert.notEqual(hyper.heartRatePerMin,normal.heartRatePerMin);
  assert(hyper.fAcSpikesPerSec>normal.fAcSpikesPerSec);
});

test('baroreflex perturbation changes autonomic state without any HR overlay',()=>{
  const normal=runConstant({map:95});
  const lowMap=runConstant({map:65});
  assert.notEqual(lowMap.fAbSpikesPerSec,normal.fAbSpikesPerSec);
  assert.notEqual(lowMap.heartRatePerMin,normal.heartRatePerMin);
});

test('larger VT changes lung-stretch and candidate HR',()=>{
  const low=runConstant({vt:0.3});
  const high=runConstant({vt:0.8});
  assert(high.fApSpikesPerSec>low.fApSpikesPerSec);
  assert.notEqual(high.heartRatePerMin,low.heartRatePerMin);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
