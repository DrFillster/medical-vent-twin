'use strict';

const assert=require('node:assert/strict');
const {
  createAcidosisGridSurrogate,
  createAcidosisGridSurrogateFromTable,
}=require('../src/shimayoshi_acidosis_grid_surrogate.js');

function run(co2,scale){
  return {
    status:'shimayoshi-source-stress-trajectory-validated',
    provenance:{
      protocolName:'acidosis',
      sourceChallengeCo2Percent:co2,
    },
    trajectory:[
      {time_s:300,protocol:'acidosis',peak_Fb_mN_per_mm2:6,stress_ratio:1,end_cycle_pHi:7.1},
      {time_s:400,protocol:'acidosis',peak_Fb_mN_per_mm2:6*scale,stress_ratio:scale,end_cycle_pHi:6.9},
      {time_s:500,protocol:'acidosis',peak_Fb_mN_per_mm2:6*(scale+0.02),stress_ratio:scale+0.02,end_cycle_pHi:6.8},
    ],
  };
}

const s=createAcidosisGridSurrogate([
  run(10,0.96),
  run(20,0.90),
  run(30,0.84),
]);

const exact=s.evaluate({sourceChallengeCo2Percent:20,sourceTimeS:400});
assert.equal(exact.peakFbMnPerMm2,5.4);
assert.equal(exact.interpolatedChallenge,false);
assert.equal(exact.closedLoopAuthority,false);

const mid=s.evaluate({sourceChallengeCo2Percent:15,sourceTimeS:400});
assert(Math.abs(mid.stressRatio-0.93)<1e-12);
assert.equal(mid.interpolatedChallenge,true);

const betweenTimes=s.evaluate({sourceChallengeCo2Percent:20,sourceTimeS:450});
assert(Math.abs(betweenTimes.stressRatio-0.91)<1e-12);
assert.equal(betweenTimes.interpolatedTime,true);

assert.throws(
  ()=>s.evaluate({sourceChallengeCo2Percent:5,sourceTimeS:400}),
  /outside validated source grid/
);
assert.throws(
  ()=>s.evaluate({sourceChallengeCo2Percent:20,sourceTimeS:900}),
  /outside validated source trajectory/
);
console.log('ok - acidosis source-grid surrogate interpolates only inside validated source domain');

const table={
  schema:'shimayoshi-acidosis-grid-table/v2',
  upstreamGitSha:'6478d2ab0acbfc88d3da461d2594658bcb2798ca',
  referencePeakFbMnPerMm2:6,
  closedLoopAuthority:false,
  timeGrid:{startTimeS:300,timeStepS:100,endTimeS:500,count:3},
  protocolTimingS:{acidosisOn:300,recoveryOn:900},
  levels:[10,20,30].map(c=>({
    sourceChallengeCo2Percent:c,
    cvodeTargetCadenceMs:0.2,
    stressRatios:run(c,1-(c-10)*0.006).trajectory.map(x=>x.stress_ratio),
  })),
};
const fromTable=createAcidosisGridSurrogateFromTable(table);
const tableMid=fromTable.evaluate({sourceChallengeCo2Percent:15,sourceTimeS:400});
assert(Math.abs(tableMid.stressRatio-0.93)<1e-12);
assert.equal(tableMid.closedLoopAuthority,false);
console.log('ok - compact source grid table loads into the same bounded surrogate');

const v3table={
  schema:'shimayoshi-acidosis-grid-table/v3',
  upstreamGitSha:'6478d2ab0acbfc88d3da461d2594658bcb2798ca',
  referencePeakFbMnPerMm2:6,
  closedLoopAuthority:false,
  protocolTimingS:{acidosisOn:300,recoveryOn:900},
  levels:[
    {
      sourceChallengeCo2Percent:10,
      cvodeTargetCadenceMs:0.2,
      keyframes:[[300,1],[400,0.95],[500,0.96]],
    },
    {
      sourceChallengeCo2Percent:20,
      cvodeTargetCadenceMs:0.2,
      keyframes:[[300,1],[400,0.85],[500,0.87]],
    },
  ],
};
const v3=createAcidosisGridSurrogateFromTable(v3table);
const v3mid=v3.evaluate({sourceChallengeCo2Percent:15,sourceTimeS:450});
assert(Math.abs(v3mid.stressRatio-0.9075)<1e-12);
assert.equal(v3mid.closedLoopAuthority,false);
assert.throws(
  ()=>v3.evaluate({sourceChallengeCo2Percent:15,sourceTimeS:250}),
  /outside validated source trajectory/
);
console.log('ok - adaptive v3 source table loads with bounded time/challenge interpolation');
