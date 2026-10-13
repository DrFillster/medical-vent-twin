'use strict';

const assert=require('node:assert/strict');
const {
  INITIAL_MASS_MEQ,
  DC,
  MEQ_ML_TO_MG_DL,
  GLUCOSE_TO_LACTATE,
  MG_TO_MEQ,
  createHumMod2013LeftHeartLactate,
}=require('../src/hummod_2013_left_heart_lactate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,tol=1e-10){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),
    a+' not near '+b);
}

test('source constants are preserved',()=>{
  near(INITIAL_MASS_MEQ,0.17);
  near(DC,18);
  near(MEQ_ML_TO_MG_DL,9008);
  near(GLUCOSE_TO_LACTATE,0.99);
  near(MG_TO_MEQ,0.0112);
});

test('source concentration algebra is preserved',()=>{
  const l=createHumMod2013LeftHeartLactate();
  const s=l.snapshot({liquidVolumeMl:100});
  near(s.lacMeqPerMl,0.17/100);
  near(s.lacMeqPerL,1000*0.17/100);
  near(s.lacMgPerDl,9008*0.17/100);
});

test('zero anaerobic glucose use creates zero local lactate production',()=>{
  const l=createHumMod2013LeftHeartLactate();
  const s=l.step({
    dtSec:1,
    liquidVolumeMl:100,
    bloodFlowMlPerMin:200,
    anaerobicGlucoseUsedMgPerMin:0,
    lactateUsedMgPerMin:0,
    lactatePoolMeqPerMl:0.0017,
  });
  near(s.madeMgPerMin,0);
  near(s.madeMeqPerMin,0);
});

test('source flow-limited exchange coefficient is preserved',()=>{
  const l=createHumMod2013LeftHeartLactate();
  const s=l.step({
    dtSec:1,
    liquidVolumeMl:100,
    bloodFlowMlPerMin:180,
    anaerobicGlucoseUsedMgPerMin:0,
    lactateUsedMgPerMin:0,
    lactatePoolMeqPerMl:0.0017,
  });
  near(s.k,(180*18)/(180+18));
});

test('backward-Euler mass update matches source linear form',()=>{
  const l=createHumMod2013LeftHeartLactate({initialMassMeq:0.17});
  const s=l.step({
    dtSec:60,
    liquidVolumeMl:100,
    bloodFlowMlPerMin:180,
    anaerobicGlucoseUsedMgPerMin:0,
    lactateUsedMgPerMin:1,
    lactatePoolMeqPerMl:0.0017,
  });
  const k=(180*18)/(180+18);
  const f1=0-(0.0112*1)+(k*0.0017);
  const f2=k/100;
  near(s.massMeq,(0.17+f1)/(1+f2));
});

test('backward-Euler trajectory converges with timestep refinement',()=>{
  function run(dtSec){
    const l=createHumMod2013LeftHeartLactate();
    const n=Math.round(600/dtSec);
    for(let i=0;i<n;i++){
      l.step({
        dtSec,
        liquidVolumeMl:100,
        bloodFlowMlPerMin:180,
        anaerobicGlucoseUsedMgPerMin:0,
        lactateUsedMgPerMin:0.2,
        lactatePoolMeqPerMl:0.0017,
      });
    }
    return l.snapshot().massMeq;
  }
  const coarse=run(10),medium=run(2),fine=run(1);
  assert(Math.abs(medium-fine)<Math.abs(coarse-fine));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
