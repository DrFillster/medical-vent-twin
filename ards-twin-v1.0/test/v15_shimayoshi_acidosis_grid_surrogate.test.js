'use strict';

const assert=require('node:assert/strict');
const {
  createAcidosisGridSurrogate,
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
