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
function pct(a,b){return 100*(a-b)/b;}
function vector(s){
  return {
    hr:s.hemodynamics.heartRatePerMin,
    map:s.hemodynamics.systemicArterialPressureMmHg,
    emaxLv:s.hemodynamics.EmaxLvMmHgPerMl,
    rsp:s.hemodynamics.splanchnicResistanceMmHgSecPerMl,
    rep:s.hemodynamics.extrasplanchnicResistanceMmHgSecPerMl,
    vusv:s.hemodynamics.splanchnicVenousUnstressedVolumeMl,
    vuev:s.hemodynamics.extrasplanchnicVenousUnstressedVolumeMl,
  };
}
function maxAbsPctDiff(a,b){
  let m=0;
  for(const k of Object.keys(a)){
    m=Math.max(m,Math.abs(pct(a[k],b[k])));
  }
  return m;
}

test('combined gas stress shows recovery toward baseline after normalization',()=>{
  const r=createGasCardiovascularClosedLoopCandidate({
    dtSec:0.002,pao2MmHg:100,paco2MmHg:40,tidalVolumeL:0.5,
  });
  r.runFor(120);
  const baseline=vector(r.snapshot());

  r.setEnvironment({pao2MmHg:50,paco2MmHg:60});
  r.runFor(120);
  const stressed=vector(r.snapshot());

  r.setEnvironment({pao2MmHg:100,paco2MmHg:40});
  r.runFor(180);
  const recovered=vector(r.snapshot());

  const stressDistance=maxAbsPctDiff(stressed,baseline);
  const recoveryDistance=maxAbsPctDiff(recovered,baseline);

  assert(stressDistance>0.1,'stress must move the integrated state');
  assert(
    recoveryDistance<stressDistance,
    'normalized gases must move the candidate back toward baseline'
  );
  assert.equal(r.snapshot().authority,'candidate-not-canonical');
});

test('explicit controller/plant coupling is convergent across tested step sizes',()=>{
  function run(dtSec){
    const r=createGasCardiovascularClosedLoopCandidate({
      dtSec,pao2MmHg:100,paco2MmHg:40,tidalVolumeL:0.5,
    });
    r.runFor(60);
    r.setEnvironment({pao2MmHg:50,paco2MmHg:60});
    r.runFor(60);
    return vector(r.snapshot());
  }

  const coarse=run(0.004);
  const reference=run(0.002);
  const fine=run(0.001);

  const coarseVsFine=maxAbsPctDiff(coarse,fine);
  const referenceVsFine=maxAbsPctDiff(reference,fine);

  assert(
    referenceVsFine<=coarseVsFine+1e-9,
    'halving dt should not move farther from the fine-step solution'
  );
  assert(
    referenceVsFine<1,
    '0.002-s candidate should be within 1% of 0.001-s solution across tracked outputs'
  );
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
