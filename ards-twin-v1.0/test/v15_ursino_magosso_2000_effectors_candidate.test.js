'use strict';

const assert=require('node:assert/strict');
const {
  SOURCE,P,sourceTargets,createUrsinoMagosso2000EffectorCandidate,
}=require('../src/ursino_magosso_2000_effectors_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('2000 source channels and distinct parameters are pinned',()=>{
  assert.equal(SOURCE.doi,'10.1152/ajpheart.2000.279.1.H149');
  assert.equal(P.effectors.Rsp.channel,'fSp');
  assert.equal(P.effectors.Rep.channel,'fSp');
  assert.equal(P.effectors.RmpNeural.channel,'fSp');
  assert.equal(P.effectors.Vusv.channel,'fSp');
  assert.equal(P.effectors.Vuev.channel,'fSp');
  assert.equal(P.effectors.Vumv.channel,'fSp');
  assert.equal(P.effectors.EmaxLv.channel,'fSh');
  assert.equal(P.effectors.Tv.channel,'fV');
  assert.equal(P.effectors.Rep.gain,1.94);
  assert.equal(P.effectors.Vuev.gain,-74.21);
  assert.equal(P.effectors.Vumv.gain,-58.29);
});

test('vascular sympathetic stimulation changes all source vascular reflex targets',()=>{
  const low=sourceTargets({fSpSpikesPerSec:4,fShSpikesPerSec:4,fVSpikesPerSec:4});
  const high=sourceTargets({fSpSpikesPerSec:12,fShSpikesPerSec:4,fVSpikesPerSec:4});
  assert(high.absolute.Rsp>low.absolute.Rsp);
  assert(high.absolute.Rep>low.absolute.Rep);
  assert(high.absolute.RmpNeural>low.absolute.RmpNeural);
  assert(high.absolute.Vusv<low.absolute.Vusv);
  assert(high.absolute.Vuev<low.absolute.Vuev);
  assert(high.absolute.Vumv<low.absolute.Vumv);
  assert.equal(high.absolute.EmaxLv,low.absolute.EmaxLv);
  assert.equal(high.absolute.heartPeriodSec,low.absolute.heartPeriodSec);
});

test('cardiac sympathetic stimulation changes Emax and heart period but not vascular targets',()=>{
  const low=sourceTargets({fSpSpikesPerSec:6,fShSpikesPerSec:4,fVSpikesPerSec:4});
  const high=sourceTargets({fSpSpikesPerSec:6,fShSpikesPerSec:12,fVSpikesPerSec:4});
  assert(high.absolute.EmaxLv>low.absolute.EmaxLv);
  assert(high.absolute.EmaxRv>low.absolute.EmaxRv);
  assert(high.absolute.heartPeriodSec<low.absolute.heartPeriodSec);
  assert.equal(high.absolute.Rsp,low.absolute.Rsp);
  assert.equal(high.absolute.Vusv,low.absolute.Vusv);
});

test('dynamic candidate exports source venous-volume rates for vascular equations',()=>{
  const c=createUrsinoMagosso2000EffectorCandidate({
    initialFSpSpikesPerSec:6,
    initialFShSpikesPerSec:6,
    initialFVSpikesPerSec:4,
  });
  const s=c.step({
    dtSec:0.1,
    fSpSpikesPerSec:10,
    fShSpikesPerSec:8,
    fVSpikesPerSec:4,
  });
  assert(Number.isFinite(s.rate.Vusv));
  assert(Number.isFinite(s.rate.Vumv));
  assert(Number.isFinite(s.rate.Vuev));
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.canonicalControlAuthority,false);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
