'use strict';

const { createThoraxState } = require('../src/hummod_ards_core_thorax.js');

let passed=0, failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}
function near(a,b,t=1e-12){assert(Math.abs(a-b)<=t,a+' != '+b);}

test('thorax partitions static airway-pressure changes by chest-wall elastance fraction',()=>{
  const t=createThoraxState({
    referenceAirwayPressureCmH2O:8,
    referencePleuralPressureCmH2O:6,
    chestWallElastanceFraction:0.25,
    provenance:{kind:'synthetic-test'},
  });
  const x=t.atStaticAirwayPressure(14);
  near(x.deltaAirwayCmH2O,6);
  near(x.deltaPleuralCmH2O,1.5);
  near(x.pleuralPressureCmH2O,7.5);
  near(x.deltaTranspulmonaryCmH2O,4.5);
  near(x.transpulmonaryPressureCmH2O,6.5);
});

test('spontaneous inspiratory Pmus lowers pleural pressure without changing Paw',()=>{
  const t=createThoraxState({
    referenceAirwayPressureCmH2O:8,
    referencePleuralPressureCmH2O:6,
    chestWallElastanceFraction:0.25,
    provenance:{kind:'synthetic-test'},
  });
  const passive=t.atStaticAirwayPressure(14);
  const active=t.atAirwayAndMusclePressure(14,5);
  near(active.airwayPressureCmH2O,passive.airwayPressureCmH2O);
  near(active.pleuralPressureCmH2O,passive.pleuralPressureCmH2O-5);
  near(active.transpulmonaryPressureCmH2O,passive.transpulmonaryPressureCmH2O+5);
  near(active.musclePleuralContributionCmH2O,-5);
});

test('zero Pmus is numerically identical to passive thorax path',()=>{
  const t=createThoraxState({
    referenceAirwayPressureCmH2O:8,
    referencePleuralPressureCmH2O:6,
    chestWallElastanceFraction:0.25,
    provenance:{kind:'synthetic-test'},
  });
  const a=t.atStaticAirwayPressure(11);
  const b=t.atAirwayAndMusclePressure(11,0);
  near(a.pleuralPressureCmH2O,b.pleuralPressureCmH2O);
  near(a.transpulmonaryPressureCmH2O,b.transpulmonaryPressureCmH2O);
  near(a.deltaPleuralCmH2O,b.deltaPleuralCmH2O);
});

test('thorax requires explicit provenance',()=>{
  let threw=false;
  try{
    createThoraxState({
      referenceAirwayPressureCmH2O:8,
      referencePleuralPressureCmH2O:6,
      chestWallElastanceFraction:0.25,
    });
  }catch(_){threw=true;}
  assert(threw);
});

test('thorax rejects impossible elastance fractions',()=>{
  let threw=false;
  try{
    createThoraxState({
      referenceAirwayPressureCmH2O:8,
      referencePleuralPressureCmH2O:6,
      chestWallElastanceFraction:1.2,
      provenance:{kind:'synthetic-test'},
    });
  }catch(_){threw=true;}
  assert(threw);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
