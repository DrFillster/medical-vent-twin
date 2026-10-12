'use strict';

const assert=require('node:assert/strict');
const {
  derivedRestingControlState,
}=require('../src/ursino_1998_closed_loop_runtime.js');
const {
  SOURCE,P,sourceTargets,
}=require('../src/ursino_magosso_channelized_effectors_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function close(a,b,tol=1e-12){
  return Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b));
}

test('candidate remains explicitly non-canonical',()=>{
  assert.equal(SOURCE.authority,'candidate-not-canonical');
  assert.equal(P.effectors.Rsp.channel,'fSp');
  assert.equal(P.effectors.Vusv.channel,'fSv');
  assert.equal(P.effectors.EmaxLv.channel,'fSh');
  assert.equal(P.effectors.Tv.channel,'fV');
});

test('equal sympathetic channels reproduce the verified 1998 basal effector state',()=>{
  const old=derivedRestingControlState();
  const next=sourceTargets({
    fSpSpikesPerSec:old.fEs,
    fSvSpikesPerSec:old.fEs,
    fShSpikesPerSec:old.fEs,
    fVSpikesPerSec:old.fEv,
  });

  assert(close(next.delta.EmaxLv,old.dEmaxLv));
  assert(close(next.delta.EmaxRv,old.dEmaxRv));
  assert(close(next.delta.Rsp,old.dRsp));
  assert(close(next.delta.Rep,old.dRep));
  assert(close(next.delta.Vusv,old.dVusv));
  assert(close(next.delta.Vuev,old.dVuev));
  assert(close(next.delta.Ts,old.dTs));
  assert(close(next.delta.Tv,old.dTv));
  assert(close(next.absolute.heartPeriodSec,old.heartPeriodSec));
});

test('venous sympathetic channel changes only venous unstressed-volume targets',()=>{
  const base=sourceTargets({
    fSpSpikesPerSec:6,
    fSvSpikesPerSec:6,
    fShSpikesPerSec:6,
    fVSpikesPerSec:4,
  });
  const high=sourceTargets({
    fSpSpikesPerSec:6,
    fSvSpikesPerSec:12,
    fShSpikesPerSec:6,
    fVSpikesPerSec:4,
  });

  assert(high.absolute.Vusv<base.absolute.Vusv);
  assert(high.absolute.Vuev<base.absolute.Vuev);
  assert.equal(high.absolute.Rsp,base.absolute.Rsp);
  assert.equal(high.absolute.Rep,base.absolute.Rep);
  assert.equal(high.absolute.EmaxLv,base.absolute.EmaxLv);
  assert.equal(high.absolute.EmaxRv,base.absolute.EmaxRv);
  assert.equal(high.absolute.heartPeriodSec,base.absolute.heartPeriodSec);
});

test('arterial sympathetic channel changes resistance without changing venous or cardiac targets',()=>{
  const base=sourceTargets({
    fSpSpikesPerSec:6,
    fSvSpikesPerSec:6,
    fShSpikesPerSec:6,
    fVSpikesPerSec:4,
  });
  const high=sourceTargets({
    fSpSpikesPerSec:12,
    fSvSpikesPerSec:6,
    fShSpikesPerSec:6,
    fVSpikesPerSec:4,
  });

  assert(high.absolute.Rsp>base.absolute.Rsp);
  assert(high.absolute.Rep>base.absolute.Rep);
  assert.equal(high.absolute.Vusv,base.absolute.Vusv);
  assert.equal(high.absolute.Vuev,base.absolute.Vuev);
  assert.equal(high.absolute.EmaxLv,base.absolute.EmaxLv);
  assert.equal(high.absolute.heartPeriodSec,base.absolute.heartPeriodSec);
});

test('cardiac sympathetic channel increases Emax and shortens sympathetic heart-period contribution',()=>{
  const base=sourceTargets({
    fSpSpikesPerSec:6,
    fSvSpikesPerSec:6,
    fShSpikesPerSec:6,
    fVSpikesPerSec:4,
  });
  const high=sourceTargets({
    fSpSpikesPerSec:6,
    fSvSpikesPerSec:6,
    fShSpikesPerSec:12,
    fVSpikesPerSec:4,
  });

  assert(high.absolute.EmaxLv>base.absolute.EmaxLv);
  assert(high.absolute.EmaxRv>base.absolute.EmaxRv);
  assert(high.absolute.heartPeriodSec<base.absolute.heartPeriodSec);
  assert.equal(high.absolute.Rsp,base.absolute.Rsp);
  assert.equal(high.absolute.Vusv,base.absolute.Vusv);
});

test('vagal channel changes heart period only',()=>{
  const low=sourceTargets({
    fSpSpikesPerSec:6,
    fSvSpikesPerSec:6,
    fShSpikesPerSec:6,
    fVSpikesPerSec:2,
  });
  const high=sourceTargets({
    fSpSpikesPerSec:6,
    fSvSpikesPerSec:6,
    fShSpikesPerSec:6,
    fVSpikesPerSec:7,
  });

  assert(high.absolute.heartPeriodSec>low.absolute.heartPeriodSec);
  assert.equal(high.absolute.EmaxLv,low.absolute.EmaxLv);
  assert.equal(high.absolute.Rsp,low.absolute.Rsp);
  assert.equal(high.absolute.Vusv,low.absolute.Vusv);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
