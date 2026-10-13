'use strict';

const assert=require('node:assert/strict');
const {
  REQUIRED_UPSTREAM,
  createHumMod2013LiveMyocardialAcidBaseProvider,
}=require('../src/hummod_2013_live_myocardial_acid_base_provider.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('provider declares exactly the nine upstream states',()=>{
  assert.deepEqual(REQUIRED_UPSTREAM,[
    'bloodSidMolPerL',
    'arterialHco3MolPerL',
    'intracellularPotassiumMeqPerMl',
    'leftVentricleLiquidVolumeMl',
    'myocardialBloodFlowMlPerMin',
    'myocardialO2UseMlPerMin',
    'anaerobicGlucoseUseMgPerMin',
    'myocardialLactateUseMgPerMin',
    'systemicLactatePoolMeqPerMl',
  ]);
});

test('provider derives myocardial pHi while owning lactate and CO2 state',()=>{
  const p=createHumMod2013LiveMyocardialAcidBaseProvider({
    initialLeftVentricleLiquidVolumeMl:100,
  });
  const s=p.step({
    dtSec:0.002,
    bloodSidMolPerL:0.040,
    arterialHco3MolPerL:0.024,
    intracellularPotassiumMeqPerMl:0.140,
    leftVentricleLiquidVolumeMl:100,
    myocardialBloodFlowMlPerMin:250,
    myocardialO2UseMlPerMin:25,
    anaerobicGlucoseUseMgPerMin:0,
    myocardialLactateUseMgPerMin:0,
    systemicLactatePoolMeqPerMl:0.001,
  });
  assert(Number.isFinite(s.myocardialIntracellularPh));
  assert(Number.isFinite(s.internalState.myocardialLactateMassMeq));
  assert(Number.isFinite(s.internalState.myocardialCo2Mass));
  assert.equal(s.canonicalControlAuthority,false);
});

test('provider has no myocardial pHi input path',()=>{
  const p=createHumMod2013LiveMyocardialAcidBaseProvider({
    initialLeftVentricleLiquidVolumeMl:100,
  });
  const s=p.step({
    dtSec:0.002,
    bloodSidMolPerL:0.040,
    arterialHco3MolPerL:0.024,
    intracellularPotassiumMeqPerMl:0.140,
    leftVentricleLiquidVolumeMl:100,
    myocardialBloodFlowMlPerMin:250,
    myocardialO2UseMlPerMin:25,
    anaerobicGlucoseUseMgPerMin:0,
    myocardialLactateUseMgPerMin:0,
    systemicLactatePoolMeqPerMl:0.001,
    myocardialIntracellularPh:6.5,
  });
  assert.notEqual(s.myocardialIntracellularPh,6.5);
  assert.equal(
    Object.prototype.hasOwnProperty.call(s.upstream,'myocardialIntracellularPh'),
    false
  );
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
