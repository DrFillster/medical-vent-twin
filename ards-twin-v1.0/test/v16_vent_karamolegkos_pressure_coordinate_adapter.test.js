'use strict';

const assert=require('node:assert/strict');
const {
  createReferenceAnchoredAlveolarVolumeAdapter,
}=require('../src/v16_reference_anchored_alveolar_volume_adapter.js');
const {
  createVentKaramolegkosPressureCoordinateAdapter,
}=require('../src/v16_vent_karamolegkos_pressure_coordinate_adapter.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

function make(){
  const simulation={state:{totalVolume:0.42}};
  const volume=createReferenceAnchoredAlveolarVolumeAdapter({
    simulation,
    referenceAbsoluteAlveolarVolumeL:2.25,
    referenceProvenance:{
      sourceQualified:true,
      fixture:'focused coordinate test only',
    },
  });
  const pressure=createVentKaramolegkosPressureCoordinateAdapter({
    alveolarVolumeAdapter:volume,
    referencePleuralPressureCmH2O:-5,
    passivePatient:true,
    referenceProvenance:{
      sourceQualified:true,
      fixture:'focused passive pressure reference only',
    },
  });
  return {simulation,volume,pressure};
}

test('reference pressure coordinate is finite and source-qualified',()=>{
  const {pressure}=make();
  const s=pressure.snapshot();
  assert.equal(s.sourceQualified,true);
  assert.equal(s.passivePatient,true);
  assert(Number.isFinite(s.alveolarPressureMmHg));
  assert(Number.isFinite(s.pleuralPressureMmHg));
  assert(s.transpulmonaryPressureCmH2O>0);
});

test('increasing Vent gas volume raises passive pleural and alveolar pressure',()=>{
  const {simulation,pressure}=make();
  const a=pressure.snapshot();
  simulation.state.totalVolume=0.52;
  const b=pressure.snapshot();
  assert(b.alveolarVolumeL>a.alveolarVolumeL);
  assert(b.pleuralPressureCmH2O>a.pleuralPressureCmH2O);
  assert(b.alveolarPressureCmH2O>a.alveolarPressureCmH2O);
});

test('adapter refuses spontaneous-effort use without explicit muscle pressure',()=>{
  const simulation={state:{totalVolume:0.42}};
  const volume=createReferenceAnchoredAlveolarVolumeAdapter({
    simulation,
    referenceAbsoluteAlveolarVolumeL:2.25,
    referenceProvenance:{sourceQualified:true},
  });
  assert.throws(()=>createVentKaramolegkosPressureCoordinateAdapter({
    alveolarVolumeAdapter:volume,
    referencePleuralPressureCmH2O:-5,
    passivePatient:false,
    referenceProvenance:{sourceQualified:true},
  }),/passivePatient=true/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
