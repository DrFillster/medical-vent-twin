'use strict';

const assert=require('node:assert/strict');
const {
  INITIAL_LACTATE_MEQ_PER_L,
  OUTFLOW_KEYS,
  READINESS,
  initialLactatePool2013,
  lactatePoolConcentration2013,
  lactatePoolMassDerivative2013,
}=require('../src/hummod_2013_lactate_pool_provider.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,tol=1e-12){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),
    a+' not near '+b);
}

test('2013 lactate pool initializes from 1 mEq/L times ECFV',()=>{
  near(INITIAL_LACTATE_MEQ_PER_L,1);
  const s=initialLactatePool2013({initialEcfvMl:15000});
  near(s.initialEcfvL,15);
  near(s.initialMassMeq,15);
});

test('current lactate concentration is mass over current ECFV',()=>{
  const s=lactatePoolConcentration2013({
    massMeq:15,
    ecfvMl:15000,
  });
  near(s.concentrationMeqPerL,1);
  near(s.concentrationMgDl,9.008);
});

test('2013 source keeps left and right kidney outflows separate',()=>{
  assert(OUTFLOW_KEYS.includes('leftKidney'));
  assert(OUTFLOW_KEYS.includes('rightKidney'));
  assert(!OUTFLOW_KEYS.includes('kidney'));
});

test('pool derivative requires every source organ outflow',()=>{
  const all=Object.fromEntries(OUTFLOW_KEYS.map(k=>[k,0]));
  const s=lactatePoolMassDerivative2013({
    tissueOutflowsMeqPerMin:{...all,leftHeart:0.2,skeletalMuscle:0.3},
    ivDripLactateRateMeqPerMin:0.1,
    pumpRateMeqPerMin:0,
  });
  near(s.changeMeqPerMin,0.6);

  const missing={...all};
  delete missing.leftKidney;
  assert.throws(()=>lactatePoolMassDerivative2013({
    tissueOutflowsMeqPerMin:missing,
    ivDripLactateRateMeqPerMin:0,
    pumpRateMeqPerMin:0,
  }),/leftKidney/);
});

test('initial 1 mEq/L cannot substitute for live pool concentration',()=>{
  assert.equal(READINESS.fixedOneMeqPerLSubstitutionAllowed,false);
  assert.equal(
    READINESS.currentConcentration,
    'blocked-on-whole-body-lactate-outflux-network'
  );
  assert.equal(READINESS.olderLactatePoolModuleInterchangeable,false);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
