'use strict';

const {
  evaluateV22SepsisDiseaseLayer,
}=require('../src/v22_sepsis_disease_layer.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed+=1;}
  catch(e){console.error('FAIL -',name,':',e.message);failed+=1;}
}
function assert(cond,msg){if(!cond) throw new Error(msg||'assertion failed');}

test('zero inflammation returns normal Yamanaka disease-layer state',()=>{
  const s=evaluateV22SepsisDiseaseLayer({
    inflammationNStar:0,
    antiInflammatoryMediatorCA:0,
  });
  assert(Math.abs(s.capillaryPermeabilityMlPerMmHgSec-0.01)<1e-12);
  assert(Math.abs(s.capillaryPermeabilityRatio-1)<1e-12);
  assert(Math.abs(s.sourceStrokeVolumeMl-73.8)<1e-9);
  assert(Math.abs(s.leftMyocardialPerformanceMultiplier-1)<1e-12);
  assert(s.vasodilationDecrement===0);
});

test('inflammation increases permeability and vasodilation signal',()=>{
  const low=evaluateV22SepsisDiseaseLayer({
    inflammationNStar:0.1,
    antiInflammatoryMediatorCA:0,
  });
  const high=evaluateV22SepsisDiseaseLayer({
    inflammationNStar:1.0,
    antiInflammatoryMediatorCA:0,
  });
  assert(high.capillaryPermeabilityMlPerMmHgSec>
    low.capillaryPermeabilityMlPerMmHgSec);
  assert(high.vasodilationDecrement>low.vasodilationDecrement);
  assert(high.leftMyocardialPerformanceMultiplier<
    low.leftMyocardialPerformanceMultiplier);
});

test('sepsis layer refuses implied live authority for unresolved bridges',()=>{
  const s=evaluateV22SepsisDiseaseLayer({
    inflammationNStar:1,
    antiInflammatoryMediatorCA:0.1,
  });
  assert(s.liveAuthority.leftMyocardialPerformanceMultiplier===true);
  assert(s.liveAuthority.systemicVasodilation===false);
  assert(s.liveAuthority.capillaryLeakVolume===false);
  assert(/source-traceable/.test(s.unresolved.systemicVasodilation));
  assert(/No effective-volume loss gain/.test(s.unresolved.capillaryLeak));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
