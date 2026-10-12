'use strict';

const assert=require('node:assert/strict');
const {
  SOURCE,
  defaultNumericalSeed,
  createHennigsNeuralOscillatorRuntime,
}=require('../src/hennigs_neural_oscillator_runtime.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('runtime remains candidate-only with no control authority',()=>{
  const r=createHennigsNeuralOscillatorRuntime();
  const s=r.snapshot();
  assert.equal(SOURCE.authority,'candidate-not-canonical');
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.controlAuthority,false);
});

test('default numerical seed is finite and explicitly numerical',()=>{
  const s=defaultNumericalSeed();
  for(const [k,v] of Object.entries(s)){
    assert(Number.isFinite(v),k);
  }
});

test('runtime advances finite neural states at fixed Drel',()=>{
  const r=createHennigsNeuralOscillatorRuntime({dtSec:0.001,dRel:0.5});
  const a=r.snapshot();
  const b=r.runFor(10);
  assert(b.timeSec>a.timeSec);
  for(const [k,v] of Object.entries(b.state)){
    assert(Number.isFinite(v),k);
  }
  for(const [k,v] of Object.entries(b.neuralOutput)){
    assert(Number.isFinite(v),k);
    assert(v>=0&&v<=4,k);
  }
});

test('Drel update changes prescribed Eq9 respiratory rate without inventing chemistry',()=>{
  const r=createHennigsNeuralOscillatorRuntime({dtSec:0.001,dRel:0.2});
  const low=r.snapshot();
  r.setRelativeDrive(0.8);
  const high=r.snapshot();
  assert(high.prescribedRespiratoryRatePerMin>low.prescribedRespiratoryRatePerMin);
  assert.equal(high.dRel,0.8);
});

test('runFor fails closed on non-integral fixed-step duration',()=>{
  const r=createHennigsNeuralOscillatorRuntime({dtSec:0.003,dRel:0.5});
  assert.throws(()=>r.runFor(1),/integer multiple/);
});

test('Drel outside source normalized range fails closed',()=>{
  assert.throws(()=>createHennigsNeuralOscillatorRuntime({dRel:1.1}),/between 0 and 1/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
