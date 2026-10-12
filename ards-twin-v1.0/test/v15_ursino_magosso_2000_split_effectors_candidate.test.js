'use strict';

const assert=require('node:assert/strict');
const {
  SOURCE,P,sourceTargets,aggregateExtrasplanchnicReflexState,
}=require('../src/ursino_magosso_2000_split_effectors_candidate.js');
const {
  VASCULAR:EXPANDED_VASCULAR,
}=require('../src/ursino_magosso_2000_expanded_vascular_candidate.js');

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

test('zero-drive split resistance offsets reproduce the prior aggregate extrasplanchnic offset',()=>{
  const split=aggregateExtrasplanchnicReflexState({
    vascularSympatheticSpikesPerSec:P.thresholdSpikesPerSec,
  });
  assert(close(
    split.peripheralResistanceMmHgSecPerMl,
    0.78,
    2e-4
  ));
});

test('split venous offsets and gains preserve the prior aggregate venous effector decomposition',()=>{
  assert(close(
    P.effectors.Vuev.offset+
      P.effectors.Vumv.offset+
      EXPANDED_VASCULAR.bv.Vu+
      EXPANDED_VASCULAR.hv.Vu,
    1537,
    2e-4
  ));
  assert(close(
    P.effectors.Vuev.gain+P.effectors.Vumv.gain,
    -132.5,
    1e-12
  ));
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
