'use strict';

const assert=require('node:assert/strict');
const {buildTable}=require('../scripts/build-shimayoshi-acidosis-grid-table.js');

function run(co2,ratio){
  return {
    status:'shimayoshi-source-stress-trajectory-validated',
    referencePeakStressMnPerMm2:6,
    provenance:{
      upstreamGitSha:'6478d2ab0acbfc88d3da461d2594658bcb2798ca',
      protocolName:'acidosis',
      sourceChallengeCo2Percent:co2,
      cvodeTargetCadenceMs:0.2,
    },
    trajectory:[
      {time_s:300,protocol:'acidosis',peak_Fb_mN_per_mm2:6,stress_ratio:1,end_cycle_pHi:7.1},
      {time_s:400,protocol:'acidosis',peak_Fb_mN_per_mm2:6*ratio,stress_ratio:ratio,end_cycle_pHi:6.9},
    ],
  };
}

const t=buildTable([run(20,0.9),run(10,0.95)]);
assert.equal(t.schema,'shimayoshi-acidosis-grid-table/v2');
assert.deepEqual(t.levels.map(x=>x.sourceChallengeCo2Percent),[10,20]);
assert.equal(t.levels[0].stressRatios[1],0.95);
assert.equal(t.timeGrid.startTimeS,300);
assert.equal(t.timeGrid.timeStepS,100);
assert.equal(t.timeGrid.count,2);
assert.equal(t.closedLoopAuthority,false);
console.log('ok - compact acidosis grid table retains source force trajectory and provenance only');

const boundaryRun=run(30,0.9);
boundaryRun.trajectory=[
  {time_s:299.6,protocol:'control',peak_Fb_mN_per_mm2:6,stress_ratio:1},
  {time_s:300.0,protocol:'acidosis',peak_Fb_mN_per_mm2:6,stress_ratio:1},
  {time_s:300.4,protocol:'acidosis',peak_Fb_mN_per_mm2:5.99,stress_ratio:0.998},
  {time_s:899.6,protocol:'acidosis',peak_Fb_mN_per_mm2:5.7,stress_ratio:0.95},
  {time_s:900.0,protocol:'control',peak_Fb_mN_per_mm2:5.7,stress_ratio:0.95},
];
const boundaryRun2=JSON.parse(JSON.stringify(boundaryRun));
boundaryRun2.provenance.sourceChallengeCo2Percent=20;
const bt=buildTable([boundaryRun2,boundaryRun]);
for(const level of bt.levels){
  const times=level.keyframes.map(x=>x[0]);
  assert(times.includes(299.6));
  assert(times.includes(300));
  assert(times.includes(899.6));
  assert(times.includes(900));
}
console.log('ok - adaptive table preserves source phase-boundary cycles explicitly');
