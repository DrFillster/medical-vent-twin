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

function sourceBasalVascularSympatheticFiring(){
  // Invert the source static effector equation using the source basal
  // splanchnic resistance. This derives the common basal f_sp from the
  // published source parameters; it is not a fitted value.
  const cfg=P.effectors.Rsp;
  return P.thresholdSpikesPerSec-1+
    Math.exp((EXPANDED_VASCULAR.sp.R-cfg.offset)/cfg.gain);
}

test('split effector curves reproduce all source Table 1 basal vascular values at one common basal firing',()=>{
  const f=sourceBasalVascularSympatheticFiring();
  const x=sourceTargets({
    vascularSympatheticSpikesPerSec:f,
    cardiacSympatheticSpikesPerSec:f,
    cardiacVagalSpikesPerSec:0,
  }).absolute;

  assert(close(x.Rsp,EXPANDED_VASCULAR.sp.R,2e-3));
  assert(close(x.Rep,EXPANDED_VASCULAR.ep.R,2e-3));
  assert(close(x.RmpNormal,EXPANDED_VASCULAR.mp.R,2e-3));
  assert(close(x.Vusv,EXPANDED_VASCULAR.sv.Vu,2e-3));
  assert(close(x.Vuev,EXPANDED_VASCULAR.ev.Vu,2e-3));
  assert(close(x.Vumv,EXPANDED_VASCULAR.mv.Vu,2e-3));
});

test('source basal split reproduces the prior aggregate extrasplanchnic basal properties',()=>{
  const f=sourceBasalVascularSympatheticFiring();
  const split=aggregateExtrasplanchnicReflexState({
    vascularSympatheticSpikesPerSec:f,
  });
  assert(close(
    split.peripheralResistanceMmHgSecPerMl,
    1.407,
    3e-3
  ));
  assert(close(
    split.venousUnstressedVolumeMl,
    1375,
    3e-3
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
