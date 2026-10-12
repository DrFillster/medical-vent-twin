'use strict';

const assert=require('node:assert/strict');
const {
  SOURCE,P,createUrsinoMagosso2000TidalVolumeCandidate,
}=require('../src/ursino_magosso_2000_tidal_volume_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('primary source parameters and authority are pinned',()=>{
  assert.equal(SOURCE.doi,'10.1152/ajpheart.2000.279.1.H149');
  assert.deepEqual(SOURCE.equations,[28,29]);
  assert.equal(P.gainLPerNeuralRateUnit,0.125);
  assert.equal(P.tauSec,3);
  assert.equal(P.delaySec,6);
  assert.equal(P.basalTidalVolumeL,0.583);
  assert.equal(P.basalChemoreceptorSpikesPerSec,3.6);
});

test('basal chemoreceptor firing preserves basal VT',()=>{
  const v=createUrsinoMagosso2000TidalVolumeCandidate();
  let s;
  for(let i=0;i<200;i++) s=v.step({dtSec:0.1,fAcSpikesPerSec:3.6});
  assert(Math.abs(s.tidalVolumeL-0.583)<1e-12);
  assert.equal(s.canonicalControlAuthority,false);
});

test('increased chemoreceptor firing changes VT only after source delay',()=>{
  const v=createUrsinoMagosso2000TidalVolumeCandidate();
  let s;
  for(let i=0;i<59;i++){
    s=v.step({dtSec:0.1,fAcSpikesPerSec:8});
  }
  assert(
    Math.abs(s.tidalVolumeL-0.583)<1e-9,
    'VT must remain basal before the 6-s source delay expires'
  );
  for(let i=0;i<81;i++){
    s=v.step({dtSec:0.1,fAcSpikesPerSec:8});
  }
  assert(
    s.tidalVolumeL>0.583,
    'VT must increase after the 6-s source delay'
  );
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
