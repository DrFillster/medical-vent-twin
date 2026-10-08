'use strict';
const {
  MYOCARDIAL_FUEL_DELAY,
  stableDelayDerivative,
  stepStableDelayPiecewiseConstant,
}=require('../src/hummod_stable_delay_source_aligned.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function near(a,b,tol=1e-12){assert(Math.abs(a-b)<=tol,a+' not near '+b);}

test('preserves myocardial fuel StableDelay declared constants',()=>{
  near(MYOCARDIAL_FUEL_DELAY.initialValue,1);
  near(MYOCARDIAL_FUEL_DELAY.rateConstantPerMin,0.5);
  near(MYOCARDIAL_FUEL_DELAY.errorLimit,0.01);
  near(MYOCARDIAL_FUEL_DELAY.dxMaxMin,1);
});

test('derivative matches native run06 left-heart sample',()=>{
  near(stableDelayDerivative({
    input:0.213426193911359,
    output:0.785857070054632,
    rateConstantPerMin:0.5,
  }),-0.2862154380716365,1e-14);
});

test('derivative matches native run06 right-heart sample',()=>{
  near(stableDelayDerivative({
    input:0.200010562447762,
    output:0.767212677218743,
    rateConstantPerMin:0.5,
  }),-0.28360105738549046,1e-14);
});

test('piecewise-constant helper converges toward input without overshoot',()=>{
  const s=stepStableDelayPiecewiseConstant({input:0.2,output:1,dtMin:1/60});
  assert(s.nextOutput<1&&s.nextOutput>0.2);
  assert(s.solver.sourceDerivativeIdentity===true);
  assert(s.solver.exactDesSolverIdentity===false);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
