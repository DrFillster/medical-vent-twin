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
