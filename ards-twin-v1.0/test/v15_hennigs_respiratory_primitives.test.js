'use strict';

const assert=require('node:assert/strict');
const {
  SOURCE,
  inheritedNeuralSigmoid,
  firstOrderDriveStep,
  peripheralHypoxiaTarget,
  heringBreuerDrive,
  inspiratoryFlowDrive,
  upperAirwayPressure,
  respiratoryMusclePressure,
  respiratoryMuscleGain,
}=require('../src/hennigs_respiratory_center_primitives.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('Hennigs primitives remain candidate-only',()=>{
  assert.equal(SOURCE.authority,'candidate-not-canonical');
});

test('inherited sigmoid is finite, bounded, and monotone over sampled domain',()=>{
  let prior=-Infinity;
  for(let i=-100;i<=800;i++){
    const x=i/100;
    const y=inheritedNeuralSigmoid(x);
    assert(Number.isFinite(y));
    assert(y>=0&&y<=4);
    assert(y>=prior-1e-12);
    prior=y;
  }
});

test('first-order helper moves toward source target without overshoot',()=>{
  const a=firstOrderDriveStep({
    drive:0,target:10,tauSec:1,dtSec:0.1,
  });
  assert(a.drive>0&&a.drive<10);
  assert(a.derivative>0);
});

test('hypoxia target fails closed above threshold',()=>{
  assert.equal(
    peripheralHypoxiaTarget({pao2:100,threshold:75,gain:0.2}),
    0
  );
  assert(
    peripheralHypoxiaTarget({pao2:50,threshold:75,gain:0.2})>0
  );
});

test('Hering-Breuer and inspiratory-flow transforms are finite',()=>{
  assert(Number.isFinite(heringBreuerDrive({
    lungVolume:3,
    endExpiratoryVolume:2,
    thresholdVolume:1,
    kPrs:7.5,
  })));
  assert(Number.isFinite(inspiratoryFlowDrive({
    inspiratoryFlow:0.5,
    kInsp:2,
  })));
});

test('upper-airway pressure preserves Hennigs sign convention algebra',()=>{
  assert.equal(upperAirwayPressure({
    upperAirwayResistance:2,
    airwayFlow:3,
    musclePressure:4,
  }),2);
});

test('piecewise Pmus supports inspiratory, expiratory, and neutral branches',()=>{
  assert.equal(respiratoryMusclePressure({
    inspiratoryActivity:2,
    expiratoryActivity:1,
    kI:3,kE:4,
  }),6);
  assert.equal(respiratoryMusclePressure({
    inspiratoryActivity:-1,
    expiratoryActivity:7.2,
    expiratoryThreshold:5.2,
    kI:3,kE:4,
  }),-8);
  assert.equal(respiratoryMusclePressure({
    inspiratoryActivity:-1,
    expiratoryActivity:1,
    kI:3,kE:4,
  }),0);
});

test('Eq17 gain decreases to zero with complete respiratory failure',()=>{
  const normal=respiratoryMuscleGain({
    maxPressure:100,
    maxNeuralActivation:10,
    respiratoryFailureFraction:0,
  });
  const failed=respiratoryMuscleGain({
    maxPressure:100,
    maxNeuralActivation:10,
    respiratoryFailureFraction:1,
  });
  assert(normal>0);
  assert.equal(failed,0);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
