'use strict';

const assert=require('node:assert/strict');
const {
  OTHER_MASS_KG,
  AGE_ON_OTHER_MASS,
  LEFT_HEART_PERCENT,
  hermite,
  contextOtherMass2013,
  initialLeftHeartMass2013,
}=require('../src/hummod_2013_left_heart_mass_provider.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,tol=1e-12){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),
    a+' not near '+b);
}

test('source constants and age curve are preserved',()=>{
  assert.deepEqual(OTHER_MASS_KG.male,[19,26,32,46]);
  assert.deepEqual(OTHER_MASS_KG.female,[15,20.8,28,36]);
  near(LEFT_HEART_PERCENT,1.1);
  near(hermite(AGE_ON_OTHER_MASS,18),1);
  near(hermite(AGE_ON_OTHER_MASS,70),1);
  near(hermite(AGE_ON_OTHER_MASS,9),0.4);
});

test('deterministic adult male normal context reproduces source algebra',()=>{
  const s=initialLeftHeartMass2013({
    sex:'male',
    index:1,
    ageYears:30,
    plusMinusPercent:0,
    stochasmPercent:0,
  });
  near(s.contextOtherMass.massKg,26);
  near(s.baseMassG,26000);
  near(s.initialLeftHeartMassG,286);
  assert.equal(s.controlAuthority,false);
});

test('adult female normal context remains source-distinct',()=>{
  const s=initialLeftHeartMass2013({
    sex:'female',
    index:1,
    ageYears:30,
    plusMinusPercent:0,
    stochasmPercent:0,
  });
  near(s.contextOtherMass.massKg,20.8);
  near(s.initialLeftHeartMassG,228.8);
});

test('age, plus-minus, and stochastic term are explicit coordinates',()=>{
  const base=contextOtherMass2013({
    sex:'male',index:1,ageYears:30,plusMinusPercent:0,stochasmPercent:0,
  });
  const younger=contextOtherMass2013({
    sex:'male',index:1,ageYears:9,plusMinusPercent:0,stochasmPercent:0,
  });
  const larger=contextOtherMass2013({
    sex:'male',index:1,ageYears:30,plusMinusPercent:10,stochasmPercent:0,
  });
  const stochastic=contextOtherMass2013({
    sex:'male',index:1,ageYears:30,plusMinusPercent:0,stochasmPercent:10,
  });
  assert(younger.massKg<base.massKg);
  near(larger.massKg,base.massKg*1.10);
  near(stochastic.massKg,base.massKg*1.10);
});

test('stochasm cannot be silently omitted',()=>{
  assert.throws(()=>initialLeftHeartMass2013({
    sex:'male',index:1,ageYears:30,plusMinusPercent:0,
  }),/stochasmPercent/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
