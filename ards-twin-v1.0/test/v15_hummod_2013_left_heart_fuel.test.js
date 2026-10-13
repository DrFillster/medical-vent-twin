'use strict';

const assert=require('node:assert/strict');
const {
  INSULIN_EFFECT,
  FA_USED_FRACTION,
  hermite,
  leftHeartFuelInstant2013,
  createHumMod2013LeftHeartFuel,
}=require('../src/hummod_2013_left_heart_fuel.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,tol=1e-10){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),
    a+' not near '+b);
}

const BASE=Object.freeze({
  insulinReceptorBoundFractionPercent:8,
  glucosePoolMgPerMl:1.10,
  fattyAcidPoolMgPerMl:0.160,
  lactatePoolMeqPerMl:0.0017,
  plasmaFlowMlPerMin:200,
  myocardialLactateMeqPerMl:0.0017,
  aerobicCalsPerMin:120,
  totalCalsUsedPerMin:140,
  o2UseMlPerMin:25,
});

test('source insulin and fatty-acid curves are preserved',()=>{
  near(hermite(INSULIN_EFFECT,0),0.15);
  near(hermite(INSULIN_EFFECT,8),0.50);
  near(hermite(INSULIN_EFFECT,100),1.0);
  near(hermite(FA_USED_FRACTION,0),0);
  near(hermite(FA_USED_FRACTION,0.3),0.7);
  near(hermite(FA_USED_FRACTION,1),1);
});

test('2013 source keeps anaerobic myocardial glucose use at zero',()=>{
  const s=leftHeartFuelInstant2013(BASE);
  assert.equal(s.isFailed,false);
  assert.equal(s.anaerobicGlucoseUsedCalsPerMin,0);
  assert.equal(s.anaerobicGlucoseUsedMgPerMin,0);
});

test('source lactate delivery dimensional oddity is preserved',()=>{
  const s=leftHeartFuelInstant2013(BASE);
  near(
    s.lacDeliveredSourceUnitsPerMin,
    0.01*50*BASE.lactatePoolMeqPerMl*BASE.plasmaFlowMlPerMin
  );
});

test('zero flow or zero O2 use enters the source failed branch',()=>{
  const noFlow=leftHeartFuelInstant2013({...BASE,plasmaFlowMlPerMin:0});
  const noO2=leftHeartFuelInstant2013({...BASE,o2UseMlPerMin:0});
  assert.equal(noFlow.isFailed,true);
  assert.equal(noO2.isFailed,true);
  assert.equal(noFlow.adequacy,0);
  assert.equal(noO2.adequacy,0);
});

test('fuel inadequacy drives FractUseDelay downward without lactate-production shortcut',()=>{
  const f=createHumMod2013LeftHeartFuel();
  for(let i=0;i<600;i++){
    f.step({
      dtSec:1,
      ...BASE,
      glucosePoolMgPerMl:0.001,
      fattyAcidPoolMgPerMl:0.001,
      lactatePoolMeqPerMl:0,
    });
  }
  const s=f.snapshot();
  assert(s.fractUseDelay<1);
  assert.equal(s.anaerobicGlucoseUsedMgPerMin,0);
});

test('stable-delay implementation converges with timestep refinement',()=>{
  function run(dtSec){
    const f=createHumMod2013LeftHeartFuel();
    const n=Math.round(600/dtSec);
    for(let i=0;i<n;i++){
      f.step({
        dtSec,
        ...BASE,
        glucosePoolMgPerMl:0.001,
        fattyAcidPoolMgPerMl:0.001,
        lactatePoolMeqPerMl:0,
      });
    }
    return f.snapshot().fractUseDelay;
  }
  near(run(10),run(1),1e-9);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
