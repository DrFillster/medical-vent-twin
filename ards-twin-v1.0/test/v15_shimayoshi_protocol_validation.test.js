'use strict';

const assert=require('node:assert/strict');
const {
  phaseSegments,
  validateProtocolTrajectory,
}=require('../src/shimayoshi_protocol_validation.js');

const row=(time_s,protocol)=>({time_s,protocol});

const ischemia=[
  row(0.4,'control'),
  row(1.0,'control'),
  row(180.4,'ischemia'),
  row(1080.4,'reperfusion'),
];
const iv=validateProtocolTrajectory(ischemia,'ischemia');
assert.deepEqual(iv.observedPhases,['control','ischemia','reperfusion']);
assert.equal(iv.segments.length,3);
console.log('ok - source ischemia phase sequence validates');

const acidosis=[
  row(0.4,'control'),
  row(300.4,'acidosis'),
  row(900.4,'control'),
];
const av=validateProtocolTrajectory(acidosis,'acidosis');
assert.deepEqual(av.observedPhases,['control','acidosis','control']);
console.log('ok - source acidosis challenge and recovery sequence validates');

assert.throws(
  ()=>validateProtocolTrajectory([row(0.4,'control')],'ischemia'),
  /missing ischemia phase/
);
assert.throws(
  ()=>validateProtocolTrajectory([
    row(0.4,'control'),
    row(180.4,'ischemia'),
    row(1080.4,'control'),
  ],'ischemia'),
  /cannot return directly to control/
);
console.log('ok - incomplete or mislabeled source challenge runs fail closed');

const seg=phaseSegments([
  row(0.4,'control'),
  row(0.8,'control'),
  row(1.2,'acidosis'),
]);
assert.equal(seg[0].rowCount,2);
assert.equal(seg[1].phase,'acidosis');
console.log('ok - phase segmentation preserves source-state boundaries');

assert.throws(
  ()=>validateProtocolTrajectory([
    row(0.4,'control'),
    row(200.0,'ischemia'),
  ],'ischemia'),
  /does not match pinned source timing/
);
assert.throws(
  ()=>validateProtocolTrajectory([
    row(0.4,'control'),
    row(310.0,'acidosis'),
  ],'acidosis'),
  /does not match pinned source timing/
);
console.log('ok - source challenge transition timing is pinned to upstream protocol');
