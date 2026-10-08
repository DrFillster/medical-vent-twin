'use strict';
const {
  BASAL_CALS_USED_PER_MIN_PER_G,
  CAL_TO_O2,
  O2_TO_CAL,
  HEART_WORK_CALS,
  myocardialMetabolism,
}=require('../src/hummod_myocardial_metabolism_source_aligned.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function near(a,b,tol=1e-12){assert(Math.abs(a-b)<=tol,a+' not near '+b);}

test('preserves HumMod metabolism constants',()=>{
  near(BASAL_CALS_USED_PER_MIN_PER_G,0.0669);
  near(CAL_TO_O2,0.2093);
  near(O2_TO_CAL,4.778);
});

test('preserves left/right fixed myocardial work',()=>{
  near(HEART_WORK_CALS.left.total,111);
  near(HEART_WORK_CALS.right.total,22);
});

test('O2 need follows native calorie equation',()=>{
  const m=myocardialMetabolism({
    side:'left',myocardialMassG:300,o2UseMlPerMin:20,
  });
  const basal=0.0669*300;
  near(m.totalCalsUsed,basal+111);
  near(m.o2NeedMlPerMin,0.2093*(basal+111));
});

test('O2 lack and aerobic/anaerobic calories match source',()=>{
  const m=myocardialMetabolism({
    side:'right',myocardialMassG:100,o2UseMlPerMin:3,
  });
  near(m.o2LackMlPerMin,m.o2NeedMlPerMin-3);
  near(m.aerobicCals,O2_TO_CAL*3);
  near(m.anaerobicCals,O2_TO_CAL*m.o2LackMlPerMin);
});

test('structure thyroid and heat effects scale basal term but not fixed work',()=>{
  const a=myocardialMetabolism({
    side:'left',myocardialMassG:300,o2UseMlPerMin:20,
    thyroidEffect:1,heatMetabolismCore:1,structureEffect:1,
  });
  const b=myocardialMetabolism({
    side:'left',myocardialMassG:300,o2UseMlPerMin:20,
    thyroidEffect:2,heatMetabolismCore:1,structureEffect:1,
  });
  near(b.totalCalsUsed-a.totalCalsUsed,a.basalCalsUsed);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
