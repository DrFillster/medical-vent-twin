'use strict';

const assert=require('node:assert/strict');
const {
  createHumModSympathoadrenalSaNodeCandidate,
}=require('../src/hummod_sympathoadrenal_sa_node_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

function run({dtSec=0.1,carotidPressureMmHg=97,brainFuelFractUseDelay=null,seconds=120}={}){
  const c=createHumModSympathoadrenalSaNodeCandidate({
    ecfvMl:15000,
    initialCarotidPressureMmHg:97,
  });
  c.runFor(seconds,{
    dtSec,
    carotidPressureMmHg,
    averageAtrialTmpMmHg:6,
    brainFuelFractUseDelay,
    brainFunctionEffect:1,
    sympsChemoEffect:1,
    otherTissueFunctionEffect:1,
  });
  return c.snapshot();
}

test('candidate is source-family complete through SA-node and has no canonical authority',()=>{
  const s=run({seconds:1});
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.canonicalControlAuthority,false);
  assert.equal(s.adrenalNerveHz,s.sympsCnsHz);
  assert.equal(s.generalGangliaHz,s.sympsCnsHz);
  assert(Number.isFinite(s.catecholamines.nePgPerMl));
  assert(Number.isFinite(s.catecholamines.epiPgPerMl));
  assert(Number.isFinite(s.catecholamines.betaEffect));
  assert(Number.isFinite(s.heartRatePerMin));
});

test('baroreceptor unloading propagates through the source chain',()=>{
  const baseline=run({carotidPressureMmHg:97});
  const lowPressure=run({carotidPressureMmHg:60});
  assert(lowPressure.sympsCnsHz>baseline.sympsCnsHz);
  assert(lowPressure.adrenalNerveHz>baseline.adrenalNerveHz);
  assert(lowPressure.catecholamines.epiPgPerMl>baseline.catecholamines.epiPgPerMl);
  assert(lowPressure.saBetaActivity>baseline.saBetaActivity);
  assert(lowPressure.heartRatePerMin>baseline.heartRatePerMin);
});

test('source Brain-Fuel stress input propagates without arterial-gas shortcut',()=>{
  const baseline=run({brainFuelFractUseDelay:1});
  const fuelStress=run({brainFuelFractUseDelay:0.6});
  assert(fuelStress.sympsCnsHz>baseline.sympsCnsHz);
  assert(fuelStress.catecholamines.epiPgPerMl>baseline.catecholamines.epiPgPerMl);
  assert(fuelStress.heartRatePerMin>baseline.heartRatePerMin);
});

test('explicit operator split converges across smaller timesteps',()=>{
  const coarse=run({dtSec:0.2,carotidPressureMmHg:60});
  const reference=run({dtSec:0.1,carotidPressureMmHg:60});
  const fine=run({dtSec:0.05,carotidPressureMmHg:60});
  const coarseError=Math.abs(coarse.heartRatePerMin-fine.heartRatePerMin);
  const referenceError=Math.abs(reference.heartRatePerMin-fine.heartRatePerMin);
  assert(referenceError<=coarseError+1e-9);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
