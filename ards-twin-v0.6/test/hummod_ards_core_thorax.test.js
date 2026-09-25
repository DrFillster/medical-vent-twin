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
