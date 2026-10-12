'use strict';

const assert=require('node:assert/strict');
const {
  createHumMod2013CardiopulmonaryCompensationCandidate,
}=require('../src/hummod_2013_cardiopulmonary_compensation_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

const COMMON=Object.freeze({
  arterialO2ContentMlPerMl:0.196,
  o2MaxMlPerMl:0.200216828201916,
  venousPh:7.37776997729073,
  venousPco2MmHg:44.8382538764693,
  carboxyPercent:0.389637710489589,
  tempC:37,
  cerebralPressureGradientMmHg:89.3625792967117,
  brainPco2MmHg:46.5805596402771,
  brainO2NeedMlPerMin:39.3065407483815,
  plasmaVolumeFraction:0.56,
  glucoseMgPerMl:1.10,
  ketoacidMgPerMl:0.005,
  brainLactateMgPerDl:10,
});

function make(){
  return createHumMod2013CardiopulmonaryCompensationCandidate({
    dtSec:0.1,
    ecfvMl:15000,
    initialArterialPh:7.44,
  });
}

test('integrated candidate is noncanonical and preserves ownership boundary',()=>{
  const c=make();
  const s=c.step({
    ...COMMON,
    arterialPo2MmHg:94,
    arterialPh:7.44,
  });
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.canonicalControlAuthority,false);
  assert.equal(s.ownership.cerebralMetabolism,'parallel observation only');
  assert.match(s.ownership.acuteChronotropy,/2012\/2013/);
  assert(Number.isFinite(s.heartRatePerMin));
  assert(Number.isFinite(s.brainFlow.o2UseMlPerMin));
  assert(Number.isFinite(s.cerebralFuel.fractUseDelay));
});

test('hypoxia drives HR through newer chemoreflex while cerebral state remains parallel',()=>{
  const c=make();
  c.runFor(600,{
    ...COMMON,
    arterialPo2MmHg:94,
    arterialPh:7.44,
  });
  const b=c.snapshot();
  c.runFor(600,{
    ...COMMON,
    arterialPo2MmHg:30,
    arterialPh:7.44,
    arterialO2ContentMlPerMl:0.08,
    cerebralPressureGradientMmHg:65,
  });
  const h=c.snapshot();
  assert(h.autonomic.chemoreceptor.firingRate>b.autonomic.chemoreceptor.firingRate);
  assert(h.heartRatePerMin>b.heartRatePerMin);
  assert(h.heartRatePerMin>100);
  assert(Number.isFinite(h.cerebralFuel.fractUseDelay));
});

test('isolated acidemia does not require tachycardia >100',()=>{
  const c=make();
  c.runFor(600,{
    ...COMMON,
    arterialPo2MmHg:94,
    arterialPh:7.44,
  });
  c.runFor(600,{
    ...COMMON,
    arterialPo2MmHg:94,
    arterialPh:7.10,
  });
  const a=c.snapshot();
  assert(a.autonomic.deltaPh<0);
  assert(a.heartRatePerMin<100);
});

test('combined severe hypoxia plus acidemia remains compensatory before myocardial failure is added',()=>{
  const c=make();
  c.runFor(600,{
    ...COMMON,
    arterialPo2MmHg:94,
    arterialPh:7.44,
  });
  c.runFor(600,{
    ...COMMON,
    arterialPo2MmHg:30,
    arterialPh:7.10,
    arterialO2ContentMlPerMl:0.08,
    cerebralPressureGradientMmHg:65,
  });
  const s=c.snapshot();
  assert(s.heartRatePerMin>100);
  assert.match(s.limitations.myocardialDepression,/Not yet integrated/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
