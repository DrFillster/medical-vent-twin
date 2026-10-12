'use strict';

const assert=require('node:assert/strict');
const {
  createGasCardiovascularClosedLoopCandidate,
}=require('../src/ursino_magosso_gas_closed_loop_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

function runCase(env){
  const r=createGasCardiovascularClosedLoopCandidate({
    dtSec:0.002,
    ...env,
  });
  r.runFor(60);
  const s=r.snapshot();
  return {
    hr:s.hemodynamics.heartRatePerMin,
    map:s.hemodynamics.systemicArterialPressureMmHg,
    emaxLv:s.hemodynamics.EmaxLvMmHgPerMl,
    rsp:s.hemodynamics.splanchnicResistanceMmHgSecPerMl,
    vusv:s.hemodynamics.splanchnicVenousUnstressedVolumeMl,
    authority:s.authority,
    canonical:s.canonicalControlAuthority,
    candidate:s.candidatePlantControlAuthority,
  };
}

let baseline,hypoxia,hypercapnia,combined;

test('candidate layer is explicitly non-canonical but may own candidate plant effectors',()=>{
  baseline=runCase({pao2MmHg:100,paco2MmHg:40,tidalVolumeL:0.5});
  assert.equal(baseline.authority,'candidate-not-canonical');
  assert.equal(baseline.canonical,false);
  assert.equal(baseline.candidate,true);
});

test('isolated hypoxia produces a finite integrated candidate response',()=>{
  hypoxia=runCase({pao2MmHg:50,paco2MmHg:40,tidalVolumeL:0.5});
  for(const v of Object.values(hypoxia)){
    if(typeof v==='number') assert(Number.isFinite(v));
  }
  assert.notEqual(hypoxia.hr,baseline.hr);
  assert.notEqual(hypoxia.rsp,baseline.rsp);
});

test('isolated hypercapnia produces a finite integrated candidate response',()=>{
  hypercapnia=runCase({pao2MmHg:100,paco2MmHg:60,tidalVolumeL:0.5});
  for(const v of Object.values(hypercapnia)){
    if(typeof v==='number') assert(Number.isFinite(v));
  }
  assert.notEqual(hypercapnia.hr,baseline.hr);
  assert.notEqual(hypercapnia.rsp,baseline.rsp);
});

test('combined hypoxic hypercapnia is not silently collapsed to either isolated response',()=>{
  combined=runCase({pao2MmHg:50,paco2MmHg:60,tidalVolumeL:0.5});
  assert(Number.isFinite(combined.hr));
  assert(Number.isFinite(combined.map));
  assert.notEqual(combined.hr,hypoxia.hr);
  assert.notEqual(combined.hr,hypercapnia.hr);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
