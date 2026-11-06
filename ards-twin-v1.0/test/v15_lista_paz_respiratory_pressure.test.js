'use strict';

const assert=require('node:assert/strict');
const {
  SOURCE,
  predictPiMaxCmH2O,
  predictPeMaxCmH2O,
  predictMaxRespiratoryPressures,
}=require('../src/lista_paz_2023_respiratory_pressure_reference.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('reference module identifies source population and non-patient authority',()=>{
  assert.equal(SOURCE.authority,'source-reference-not-patient-measurement');
  assert.match(SOURCE.population,/18-80/);
});

test('female PImax reproduces primary equation exactly',()=>{
  const age=50,bmi=25;
  const expected=61.48+0.66*age+1.55*bmi-0.01*age*age;
  assert.equal(predictPiMaxCmH2O({ageYears:age,bmiKgM2:bmi,sex:'female'}),expected);
});

test('male PImax reproduces primary equation exactly',()=>{
  const age=50,bmi=25;
  const expected=98.60+1.18*age+0.76*bmi-0.02*age*age;
  assert.equal(predictPiMaxCmH2O({ageYears:age,bmiKgM2:bmi,sex:'male'}),expected);
});

test('female PEmax reproduces primary equation exactly',()=>{
  const age=50,bmi=25;
  const expected=74.75+1.67*age+1.75*bmi-0.02*age*age;
  assert.equal(predictPeMaxCmH2O({ageYears:age,bmiKgM2:bmi,sex:'female'}),expected);
});

test('male PEmax reproduces primary equation exactly',()=>{
  const age=50,bmi=25;
  const expected=58.11+3.71*age+2.64*bmi-0.04*age*age;
  assert.equal(predictPeMaxCmH2O({ageYears:age,bmiKgM2:bmi,sex:'male'}),expected);
});

test('combined output retains cmH2O and reference interpretation',()=>{
  const x=predictMaxRespiratoryPressures({ageYears:50,bmiKgM2:25,sex:'male'});
  assert(Number.isFinite(x.piMaxCmH2O));
  assert(Number.isFinite(x.peMaxCmH2O));
  assert.equal(x.interpretation,'population-reference-prediction');
});

test('age outside source population fails closed',()=>{
  assert.throws(()=>predictPiMaxCmH2O({ageYears:81,bmiKgM2:25,sex:'male'}),/outside/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
