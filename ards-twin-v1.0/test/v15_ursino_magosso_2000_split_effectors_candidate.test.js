'use strict';

const assert=require('node:assert/strict');
const {
  SOURCE,P,sourceTargets,aggregateExtrasplanchnicReflexState,
}=require('../src/ursino_magosso_2000_split_effectors_candidate.js');
const {
  CONTROL,
  sympatheticEffectorStatic,
}=require('../src/ursino_1998_closed_loop_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function close(a,b,tol=5e-3){
  return Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b));
}

test('Table 2 split effector values are pinned',()=>{
  assert.equal(SOURCE.doi,'10.1152/ajpheart.2000.279.1.H149');
  assert.equal(P.effectors.Rep.gain,1.94);
  assert.equal(P.effectors.Rep.offset,1.655);
  assert.equal(P.effectors.RmpNormal.gain,2.47);
  assert.equal(P.effectors.RmpNormal.offset,2.106);
  assert.equal(P.effectors.Vuev.gain,-74.21);
  assert.equal(P.effectors.Vumv.gain,-58.29);
  assert.equal(P.effectors.Vuev.offset,640.73);
  assert.equal(P.effectors.Vumv.offset,503.26);
});

test('split venous capacitance exactly preserves old aggregate gain',()=>{
  assert.equal(
    P.effectors.Vuev.gain+P.effectors.Vumv.gain,
    CONTROL.effectors.Vuev.G
  );
  assert(close(
    P.effectors.Vuev.offset+P.effectors.Vumv.offset+294.64+98.21,
    CONTROL.effectors.Vuev.offset,
    2e-4
  ));
});

test('split extrasplanchnic resistance reproduces old aggregate reflex response',()=>{
  for(const f of [2.66,4,6,8,12,20]){
    const split=aggregateExtrasplanchnicReflexState({
      vascularSympatheticSpikesPerSec:f,
    });
    const old=
      CONTROL.effectors.Rep.offset+
      sympatheticEffectorStatic(f,CONTROL.effectors.Rep);
    assert(
      close(split.peripheralResistanceMmHgSecPerMl,old,6e-3),
      'f='+f+' split='+split.peripheralResistanceMmHgSecPerMl+' old='+old
    );
  }
});

test('skeletal muscle source resistance remains the pre-local-control Rmpn',()=>{
  const x=sourceTargets({
    vascularSympatheticSpikesPerSec:8,
    cardiacSympatheticSpikesPerSec:8,
    cardiacVagalSpikesPerSec:4,
  });
  assert(x.absolute.RmpNormal>0);
  assert.equal(
    Object.prototype.hasOwnProperty.call(x.absolute,'Rmp'),
    false
  );
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
