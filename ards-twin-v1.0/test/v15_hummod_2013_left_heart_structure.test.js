'use strict';

const assert=require('node:assert/strict');
const {
  PH_ON_STRUCTURE,
  FUEL_ON_STRUCTURE,
  TEMPERATURE_ON_STRUCTURE,
  hermite,
  createHumMod2013LeftHeartStructure,
}=require('../src/hummod_2013_left_heart_structure.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,tol=1e-10){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),
    a+' not near '+b);
}

test('source injury curves are preserved',()=>{
  near(hermite(PH_ON_STRUCTURE,6.5),0.1);
  near(hermite(PH_ON_STRUCTURE,6.6),0.0);
  near(hermite(FUEL_ON_STRUCTURE,0.0),0.05);
  near(hermite(FUEL_ON_STRUCTURE,0.3),0.0);
  near(hermite(TEMPERATURE_ON_STRUCTURE,44),0.0);
  near(hermite(TEMPERATURE_ON_STRUCTURE,46),0.05);
});

test('normal pH fuel and temperature preserve structure effect',()=>{
  const s=createHumMod2013LeftHeartStructure();
  for(let i=0;i<600;i++){
    s.step({
      dtSec:1,
      myocardialIntracellularPh:7.0,
      fuelFractUseDelay:1.0,
      coreTempC:37,
    });
  }
  near(s.snapshot().effect,1);
  near(s.snapshot().f2,0);
});

test('acid injury decays structure by source backward-Euler form',()=>{
  const s=createHumMod2013LeftHeartStructure();
  const a=s.step({
    dtSec:60,
    myocardialIntracellularPh:6.5,
    fuelFractUseDelay:1.0,
    coreTempC:37,
  });
  near(a.f2,0.1);
  near(a.effect,1/(1+0.1));
  assert(a.effect<1);
});

test('fuel and temperature injury are additive in F2',()=>{
  const s=createHumMod2013LeftHeartStructure();
  const a=s.step({
    dtSec:60,
    myocardialIntracellularPh:7.0,
    fuelFractUseDelay:0.0,
    coreTempC:46,
  });
  near(a.fuelEffect,0.05);
  near(a.temperatureEffect,0.05);
  near(a.f2,0.10);
});

test('backward-Euler trajectory converges with timestep refinement',()=>{
  function run(dtSec){
    const s=createHumMod2013LeftHeartStructure();
    const n=Math.round(600/dtSec);
    for(let i=0;i<n;i++){
      s.step({
        dtSec,
        myocardialIntracellularPh:6.5,
        fuelFractUseDelay:1.0,
        coreTempC:37,
      });
    }
    return s.snapshot().effect;
  }
  const coarse=run(10);
  const medium=run(2);
  const fine=run(1);
  assert(Math.abs(medium-fine)<Math.abs(coarse-fine));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
