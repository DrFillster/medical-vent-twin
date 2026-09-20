'use strict';

const { buildNativeReducedCalibrationTarget }=require('../src/hummod_native_reduced_calibration.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}

function fixture(){
  return {
    schema:'vent-hummod-trajectory/v1',
    trajectoryId:'native-fixture',
    source:{repository:'riliescu/hummod-standalone',revision:'8dab57e05631f779bf5020fe0dd51874d8ae98c1',exporterVersion:'fixture'},
    nativeSolution:{reducedState:{
      'O2Artys.[O2]':{first:0.196,final:0.194},
      'O2Veins.[O2]':{first:0.157,final:0.155},
      'CO2Artys.[HCO3]':{first:0.0240,final:0.0242},
      'CO2Veins.[HCO3]':{first:0.0256,final:0.0258},
      'SystemicArtys.Vol':{first:999,final:997},
      'SystemicVeins.Vol':{first:2675,final:2677},
      'RightAtrium.Vol':{first:51,final:53},
      'PulmArty.Vol':{first:201,final:203},
      'PulmCapys.Vol':{first:200,final:202},
      'PulmVeins.Vol':{first:211,final:213},
      'LeftAtrium.Vol':{first:51,final:49},
    }},
    rows:[
      {timestampSec:0,values:{
        'PO2Artys.Pressure':90,'CO2Artys.Pressure':40,'BloodPh.ArtysPh':7.4,
        'Heart-Rate.Rate':70,'SystemicArtys.Pressure':95,'CardiacOutput.Flow(L/Min)':5.2}},
      {timestampSec:300,values:{
        'PO2Artys.Pressure':88,'CO2Artys.Pressure':41,'BloodPh.ArtysPh':7.39,
        'Heart-Rate.Rate':72,'SystemicArtys.Pressure':93,'CardiacOutput.Flow(L/Min)':5.1}},
    ],
  };
}

test('native calibration bridge uses final verified endpoint row',()=>{
  const t=buildNativeReducedCalibrationTarget(fixture());
  assert(t.endpoints.pao2MmHg===88);
  assert(t.endpoints.paco2MmHg===41);
  assert(t.endpoints.pH===7.39);
  assert(t.endpoints.heartRatePerMin===72);
  assert(t.endpoints.meanArterialPressureMmHg===93);
  assert(t.endpoints.cardiacOutputLPerMin===5.1);
  assert(t.timestampSec===300);
});

test('native calibration bridge exposes complete reduced gas initial state',()=>{
  const t=buildNativeReducedCalibrationTarget(fixture());
  assert(t.nativeReducedState.available===true);
  assert(t.nativeReducedState.initialState.arterialO2ContentMlPerMl===0.194);
  assert(t.nativeReducedState.initialState.venousO2ContentMlPerMl===0.155);
  assert(t.nativeReducedState.initialState.arterialHco3MolPerL===0.0242);
  assert(t.nativeReducedState.initialState.venousHco3MolPerL===0.0258);
});

test('native calibration bridge exposes complete reduced circulation state',()=>{
  const t=buildNativeReducedCalibrationTarget(fixture());
  assert(t.nativeCirculationState.available===true);
  assert(t.nativeCirculationState.initialVolumesMl.systemicArteries===997);
  assert(t.nativeCirculationState.initialVolumesMl.systemicVeins===2677);
  assert(t.nativeCirculationState.initialVolumesMl.pulmonaryCapillaries===202);
  assert(t.nativeCirculationState.initialVolumesMl.leftAtrium===49);
});

test('native calibration bridge cannot claim HumMod equivalence or Berlin calibration',()=>{
  const t=buildNativeReducedCalibrationTarget(fixture());
  assert(t.applicability.fullHumModEquivalent===false);
  assert(t.applicability.berlinArdsCalibration===false);
  assert(t.applicability.clinicalValidation===false);
});

test('native calibration bridge rejects missing endpoint',()=>{
  const f=fixture();
  delete f.rows[1].values['PO2Artys.Pressure'];
  let threw=false;
  try{buildNativeReducedCalibrationTarget(f);}catch(e){threw=/native PaO2/.test(e.message);}
  assert(threw);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
