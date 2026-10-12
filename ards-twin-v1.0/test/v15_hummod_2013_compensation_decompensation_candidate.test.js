'use strict';

const assert=require('node:assert/strict');
const {
  sourceSizingFromReference,
}=require('../src/hummod_2013_left_heart_pump_candidate.js');
const {
  createHumMod2013CompensationDecompensationCandidate,
}=require('../src/hummod_2013_compensation_decompensation_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

const sizing=sourceSizingFromReference({
  sourceCardiacOutputMlPerMin:5000,
  leftHeartMassG:300,
  systemicArteryTotalVolumeMl:1000,
});

function make(){
  return createHumMod2013CompensationDecompensationCandidate({
    ecfvMl:15000,
    sourceSizing:sizing,
    initialArterialPh:7.44,
  });
}

const BASE={
  dtSec:0.1,
  arterialPo2MmHg:94,
  arterialPh:7.44,
  myocardialIntracellularPh:7.0,
  meanArterialPressureMmHg:87,
  leftAtrialPressureMmHg:5.5,
  pericardialPressureMmHg:-4,
};

test('candidate is noncanonical and keeps arterial pH separate from myocardial pHi',()=>{
  const c=make();
  const s=c.step(BASE);
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.canonicalControlAuthority,false);
  assert.equal(s.controlAuthority,false);
  assert.equal(s.inputs.arterialPh,7.44);
  assert.equal(s.inputs.myocardialIntracellularPh,7.0);
  assert(Number.isFinite(s.heartRatePerMin));
  assert(Number.isFinite(s.strokeVolumeMl));
  assert(Number.isFinite(s.cardiacOutputMlPerMin));
});

test('severe hypoxia with preserved myocardial pHi produces compensatory tachycardia',()=>{
  const c=make();
  c.runFor(600,BASE);
  c.runFor(600,{
    ...BASE,
    arterialPo2MmHg:30,
  });
  const s=c.snapshot();
  assert(s.heartRatePerMin>100);
  assert(s.leftHeartContractility.phEffect===1);
  assert(s.cardiacOutputMlPerMin>0);
});

test('falling myocardial pHi depresses LV output despite persistent hypoxic adrenergic drive',()=>{
  const c=make();
  c.runFor(600,BASE);
  c.runFor(600,{
    ...BASE,
    arterialPo2MmHg:30,
  });
  const compensated=c.snapshot();

  c.runFor(300,{
    ...BASE,
    arterialPo2MmHg:30,
    arterialPh:7.10,
    myocardialIntracellularPh:6.68,
  });
  const decomp=c.snapshot();

  assert(decomp.heartRatePerMin>100);
  assert(decomp.autonomic.chemoreceptorsCns.effect>=compensated.autonomic.chemoreceptorsCns.effect);
  assert(decomp.leftHeartContractility.phEffect<compensated.leftHeartContractility.phEffect);
  assert(decomp.leftHeartContractility.contractility<compensated.leftHeartContractility.contractility);
  assert(decomp.strokeVolumeMl<compensated.strokeVolumeMl);
  assert(decomp.cardiacOutputMlPerMin<compensated.cardiacOutputMlPerMin);
});

test('recovery of oxygenation and myocardial pHi returns the pump toward baseline',()=>{
  const c=make();
  c.runFor(600,BASE);
  const baseline=c.snapshot();

  c.runFor(600,{...BASE,arterialPo2MmHg:30});
  c.runFor(300,{
    ...BASE,
    arterialPo2MmHg:30,
    arterialPh:7.10,
    myocardialIntracellularPh:6.68,
  });
  const stressed=c.snapshot();

  c.runFor(900,BASE);
  const rec=c.snapshot();

  assert(rec.leftHeartContractility.phEffect>stressed.leftHeartContractility.phEffect);
  assert(
    Math.abs(rec.strokeVolumeMl-baseline.strokeVolumeMl) <
    Math.abs(stressed.strokeVolumeMl-baseline.strokeVolumeMl)
  );
  assert(
    Math.abs(rec.cardiacOutputMlPerMin-baseline.cardiacOutputMlPerMin) <
    Math.abs(stressed.cardiacOutputMlPerMin-baseline.cardiacOutputMlPerMin)
  );
  assert(
    Math.abs(rec.leftHeartContractility.contractility-
      baseline.leftHeartContractility.contractility) <
    Math.abs(stressed.leftHeartContractility.contractility-
      baseline.leftHeartContractility.contractility)
  );
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
