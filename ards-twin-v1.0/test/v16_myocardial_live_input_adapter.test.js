'use strict';

const assert=require('node:assert/strict');
const {
  REQUIRED_EXTERNAL,
  resolveLiveChemistryFromGasSnapshot,
  resolveIntegratedMyocardialSourceState,
  composeLiveMyocardialAcidBaseInputs,
}=require('../src/v16_myocardial_live_input_adapter.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

const gasSnapshot=Object.freeze({
  boundary:Object.freeze({
    blood:Object.freeze({sidMolPerL:0.040}),
  }),
  gases:Object.freeze({
    arterial:Object.freeze({hco3MolPerL:0.024,pH:7.4}),
  }),
});

test('adapter reads SID and arterial bicarbonate from live gas snapshot',()=>{
  const x=resolveLiveChemistryFromGasSnapshot(gasSnapshot);
  assert.equal(x.bloodSidMolPerL,0.040);
  assert.equal(x.arterialHco3MolPerL,0.024);
  assert.equal(Object.prototype.hasOwnProperty.call(x,'arterialPh'),false);
});

const cardiopulmonarySnapshot=Object.freeze({
  cardiovascular:Object.freeze({
    myocardialSourceState:Object.freeze({
      coronaryBloodFlowMlPerMin:240,
      myocardialO2UseMlPerMin:24,
    }),
  }),
});

test('adapter resolves integrated myocardial flow and O2 state',()=>{
  const x=resolveIntegratedMyocardialSourceState(cardiopulmonarySnapshot);
  assert.equal(x.myocardialBloodFlowMlPerMin,240);
  assert.equal(x.myocardialO2UseMlPerMin,24);
});

test('adapter requires only the four unresolved external source states',()=>{
  assert.equal(REQUIRED_EXTERNAL.length,4);
  assert.throws(
    ()=>composeLiveMyocardialAcidBaseInputs({
      gasSnapshot,
      cardiopulmonarySnapshot,
      upstream:{intracellularPotassiumMeqPerMl:0.14},
    }),
    /missing live myocardial upstream states/
  );
});

test('adapter composes exactly nine myocardial upstream states',()=>{
  const x=composeLiveMyocardialAcidBaseInputs({
    gasSnapshot,
    cardiopulmonarySnapshot,
    upstream:{
      intracellularPotassiumMeqPerMl:0.140,
      leftVentricleLiquidVolumeMl:100,
      myocardialLactateUseMgPerMin:0,
      systemicLactatePoolMeqPerMl:0.001,
    },
  });
  assert.equal(Object.keys(x).length,9);
  assert.equal(x.bloodSidMolPerL,0.040);
  assert.equal(x.arterialHco3MolPerL,0.024);
  assert.equal(x.myocardialBloodFlowMlPerMin,240);
  assert.equal(x.myocardialO2UseMlPerMin,24);
  assert.equal(x.anaerobicGlucoseUseMgPerMin,0);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
