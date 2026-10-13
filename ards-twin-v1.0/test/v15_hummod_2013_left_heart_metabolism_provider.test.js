'use strict';

const assert=require('node:assert/strict');
const {
  BASAL_CALS_PER_MIN_PER_G,
  WORK_MOTION_CALS_PER_MIN,
  WORK_HEAT_CALS_PER_MIN,
  WORK_TOTAL_CALS_PER_MIN,
  CAL_TO_O2_ML_PER_CAL,
  O2_TO_CAL_PER_ML,
  leftHeartO2Demand2013,
}=require('../src/hummod_2013_left_heart_metabolism_provider.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,tol=1e-12){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),
    a+' not near '+b);
}

test('source metabolic and work constants are preserved',()=>{
  near(BASAL_CALS_PER_MIN_PER_G,0.0669);
  near(WORK_MOTION_CALS_PER_MIN,24);
  near(WORK_HEAT_CALS_PER_MIN,87);
  near(WORK_TOTAL_CALS_PER_MIN,111);
  near(CAL_TO_O2_ML_PER_CAL,0.2093);
  near(O2_TO_CAL_PER_ML,4.778);
});

test('neutral modifiers preserve exact source algebra',()=>{
  const s=leftHeartO2Demand2013({
    myocardialMassG:286,
    initialMyocardialMassG:286,
    calMultiplier:1,
    thyroidEffect:1,
    heatMetabolismCore:1,
    structureEffect:1,
  });
  near(s.initialBasalCalsUsed,0.0669*286);
  near(s.basalCalsUsed,0.0669*286);
  near(s.totalCalsUsed,(0.0669*286)+111);
  near(s.o2NeedMlPerMin,0.2093*((0.0669*286)+111));
  assert.equal(s.controlAuthority,false);
});

test('current myocardial mass changes demand through source basal term',()=>{
  const a=leftHeartO2Demand2013({
    myocardialMassG:250,
    initialMyocardialMassG:286,
    thyroidEffect:1,
    heatMetabolismCore:1,
    structureEffect:1,
  });
  const b=leftHeartO2Demand2013({
    myocardialMassG:300,
    initialMyocardialMassG:286,
    thyroidEffect:1,
    heatMetabolismCore:1,
    structureEffect:1,
  });
  assert(b.o2NeedMlPerMin>a.o2NeedMlPerMin);
});

test('upstream metabolic modifiers remain explicit',()=>{
  assert.throws(()=>leftHeartO2Demand2013({
    myocardialMassG:286,
    initialMyocardialMassG:286,
    heatMetabolismCore:1,
    structureEffect:1,
  }),/thyroidEffect/);
  assert.throws(()=>leftHeartO2Demand2013({
    myocardialMassG:286,
    initialMyocardialMassG:286,
    thyroidEffect:1,
    structureEffect:1,
  }),/heatMetabolismCore/);
  assert.throws(()=>leftHeartO2Demand2013({
    myocardialMassG:286,
    initialMyocardialMassG:286,
    thyroidEffect:1,
    heatMetabolismCore:1,
  }),/structureEffect/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
