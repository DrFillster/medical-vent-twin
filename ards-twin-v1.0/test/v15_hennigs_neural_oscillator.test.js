'use strict';

const assert=require('node:assert/strict');
const {
  SOURCE,W,ACTIVE_SOURCES_BY_TARGET,DECAY,
  lateInspiratoryTonic,
  respiratoryRatePerMin,
  respiratoryRateCouplingScale,
  tonicInputs,
  oscillatorDerivatives,
}=require('../src/hennigs_neural_oscillator_candidate.js');
const {inheritedNeuralSigmoid}=
  require('../src/hennigs_respiratory_center_primitives.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('oscillator remains candidate-only',()=>{
  assert.equal(SOURCE.authority,'candidate-not-canonical');
});

test('Table2 is source-row to target-column',()=>{
  assert.equal(W.I.R,-1.8);
  assert.equal(W.P.R,-2.2);
  assert.equal(W.R.R,0.7);
  assert.equal(W.E.I,-1.4);
  assert.equal(W.L.I,-5.0);
  assert.equal(W.I.L,1.4);
  assert.equal(W.R.L,-2.1);
  assert.equal(W.R.P,-2.3);
  assert.equal(W.E.P,-1.4);
  assert.equal(W.I.E,-0.7);
  assert.equal(W.R.E,-2.3);
});

test('Table2 P-to-L value is preserved but omitted by printed Eq1',()=>{
  assert.equal(W.P.L,-3.0);
  assert(!ACTIVE_SOURCES_BY_TARGET.L.includes('P'));
});

test('late-inspiratory tonic follows Table2 footnote',()=>{
  assert(Math.abs(lateInspiratoryTonic(0)+0.5901)<1e-12);
  const expected=3.628-5.628-0.5901;
  assert(Math.abs(lateInspiratoryTonic(1)-expected)<1e-12);
});

test('Eq9 and Eq10 are preserved exactly',()=>{
  const d=0.5;
  const rr=10+Math.exp(1.8*d)*2.1;
  const k=(rr-0.1212)/6.545;
  assert(Math.abs(respiratoryRatePerMin(d)-rr)<1e-12);
  assert(Math.abs(respiratoryRateCouplingScale(d)-k)<1e-12);
});

test('Eq8 scales R I P E tonic inputs but L uses its source polynomial',()=>{
  const b=tonicInputs(0.5);
  assert(Math.abs(b.R-0.5*2.19)<1e-12);
  assert(Math.abs(b.I-0.5*5.04)<1e-12);
  assert(Math.abs(b.P-0.5*3.99)<1e-12);
  assert(Math.abs(b.E-0.5*4.14)<1e-12);
  assert(Math.abs(b.L-lateInspiratoryTonic(0.5))<1e-12);
});

test('R derivative uses I->R P->R and R->R source terms',()=>{
  const state={R:1,I:2,L:3,P:4,E:5};
  const dRel=0.5;
  const o=oscillatorDerivatives({state,dRel});
  const k=respiratoryRateCouplingScale(dRel);
  const sR=inheritedNeuralSigmoid(state.R);
  const sI=inheritedNeuralSigmoid(state.I);
  const sP=inheritedNeuralSigmoid(state.P);
  const b=tonicInputs(dRel);
  const expected=
    -DECAY.R*state.R+
    k*(0.7*sR-1.8*sI-2.2*sP)+b.R;
  assert(Math.abs(o.derivatives.R-expected)<1e-12);
});

test('L derivative confirms source-target orientation independently',()=>{
  const state={R:1,I:2,L:3,P:4,E:5};
  const dRel=0.7;
  const o=oscillatorDerivatives({state,dRel});
  const k=respiratoryRateCouplingScale(dRel);
  const sR=inheritedNeuralSigmoid(state.R);
  const sI=inheritedNeuralSigmoid(state.I);
  const sL=inheritedNeuralSigmoid(state.L);
  const sE=inheritedNeuralSigmoid(state.E);
  const expected=
    -DECAY.L*state.L+
    k*(-2.1*sR+1.4*sI+2.3*sL-0.8*sE)+
    lateInspiratoryTonic(dRel);
  assert(Math.abs(o.derivatives.L-expected)<1e-12);
});

test('tonic adjustments are additive and do not rewrite base topology',()=>{
  const state={R:1,I:1,L:1,P:1,E:1};
  const a=oscillatorDerivatives({state,dRel:0.5});
  const b=oscillatorDerivatives({
    state,dRel:0.5,
    tonicAdjustments:{R:0,I:-2,L:0,P:0,E:2},
  });
  assert(Math.abs((b.derivatives.I-a.derivatives.I)+2)<1e-12);
  assert(Math.abs((b.derivatives.E-a.derivatives.E)-2)<1e-12);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
