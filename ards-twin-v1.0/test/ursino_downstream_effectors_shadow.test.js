'use strict';
const assert=require('node:assert/strict');
const {
  P,
  logEffector,
  createUrsinoDownstreamEffectorShadow,
}=require('../src/ursino_downstream_effectors_shadow.js');

assert.equal(
  logEffector(P.sympatheticThresholdSpikesPerSec,0.695),
  0
);
assert.ok(logEffector(8,0.695)>0);

const s=createUrsinoDownstreamEffectorShadow();
const a=s.step({timeSec:0,fSpSpikesPerSec:5,fShSpikesPerSec:5});
assert.ok(Number.isFinite(a.regionalResistance.splanchnic.value));
assert.ok(Number.isFinite(a.ventricularElastance.left.value));
assert.equal(a.lumpedSvr,null);
assert.equal(a.meanArterialPressureMmHg,null);
assert.equal(a.controlAuthority,false);
assert.match(a.status,/blocked/);

console.log('ok - downstream effectors expose regional states without inventing lumped hemodynamics');
