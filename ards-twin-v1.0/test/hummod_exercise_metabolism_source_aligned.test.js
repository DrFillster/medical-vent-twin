'use strict';

const {
  SOURCE_CONSTANTS,
  bicycleTargets,
  createHumModExerciseMetabolism,
}=require('../src/hummod_exercise_metabolism_source_aligned.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function near(a,b,tol,m){if(Math.abs(a-b)>tol)throw new Error(m||(`${a} not within ${tol} of ${b}`));}

test('preserves HumMod exercise constants',()=>{
  assert(SOURCE_CONSTANTS.wattsToCals===14.34);
  assert(SOURCE_CONSTANTS.tauMin===0.2);
  assert(SOURCE_CONSTANTS.bikeEfficiencyFraction===0.30);
});

test('100 W bicycle maps to native 333.333 W total target at 30 percent efficiency',()=>{
  const t=bicycleTargets({powerW:100,rpm:50});
  near(t.targetTotalWatts,100/0.30,1e-12);
  assert(t.targetMotionWatts===100);
  assert(t.targetContractionRate===50);
});

test('exercise metabolism follows source first-order delay',()=>{
  const x=createHumModExerciseMetabolism();
  const one=x.step({dtSec:12,exertionMode:3,bikePowerW:100,bikeRpm:50});
  // One source time constant (0.2 min = 12 s): exact first-order response = 1-e^-1.
  const frac=1-Math.exp(-1);
  near(one.totalWatts,(100/0.30)*frac,1e-9);
  near(one.motionWatts,100*frac,1e-9);
  near(one.contractionRate,50*frac,1e-9);
  near(one.totalCals,14.34*one.totalWatts,1e-9);
});

test('rest transition decays generated exercise state rather than snapping to zero',()=>{
  const x=createHumModExerciseMetabolism();
  x.step({dtSec:60,exertionMode:3,bikePowerW:100,bikeRpm:50});
  const before=x.snapshot().totalWatts;
  const after=x.step({dtSec:1,exertionMode:0}).totalWatts;
  assert(after>0);
  assert(after<before);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
