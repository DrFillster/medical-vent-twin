'use strict';

const assert=require('node:assert/strict');
const {
  createReferenceAnchoredAlveolarVolumeAdapter,
}=require('../src/v16_reference_anchored_alveolar_volume_adapter.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

function sim(v=0.42){
  return {state:{totalVolume:v}};
}

test('reference state reproduces authoritative absolute volume exactly',()=>{
  const simulation=sim(0.42);
  const a=createReferenceAnchoredAlveolarVolumeAdapter({
    simulation,
    referenceAbsoluteAlveolarVolumeL:2.25,
    referenceProvenance:{
      sourceQualified:true,
      fixture:'focused coordinate test only',
    },
  });
  const s=a.snapshot();
  assert.equal(s.absoluteAlveolarVolumeL,2.25);
  assert.equal(s.deltaVentElasticVolumeL,0);
  assert.equal(s.prohibitedShortcutUsed,false);
});

test('adapter propagates only Vent delta-volume after synchronization',()=>{
  const simulation=sim(0.42);
  const a=createReferenceAnchoredAlveolarVolumeAdapter({
    simulation,
    referenceAbsoluteAlveolarVolumeL:2.25,
    referenceProvenance:{
      sourceQualified:true,
      fixture:'focused coordinate test only',
    },
  });
  simulation.state.totalVolume=0.57;
  const s=a.snapshot();
  assert(Math.abs(s.deltaVentElasticVolumeL-0.15)<1e-12);
  assert(Math.abs(s.absoluteAlveolarVolumeL-2.40)<1e-12);
});

test('adapter refuses an unsourced absolute reference',()=>{
  assert.throws(()=>createReferenceAnchoredAlveolarVolumeAdapter({
    simulation:sim(),
    referenceAbsoluteAlveolarVolumeL:2.25,
    referenceProvenance:{sourceQualified:false},
  }),/sourceQualified=true/);
});

test('adapter does not derive absolute volume from Vent volume alone',()=>{
  assert.throws(()=>createReferenceAnchoredAlveolarVolumeAdapter({
    simulation:sim(),
    referenceProvenance:{sourceQualified:true},
  }),/referenceAbsoluteAlveolarVolumeL/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
