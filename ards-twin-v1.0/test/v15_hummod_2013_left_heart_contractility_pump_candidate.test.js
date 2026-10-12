'use strict';

const assert=require('node:assert/strict');
const {
  leftHeartContractility,
  hermite:contractilityHermite,
  PH_EFFECT,
}=require('../src/hummod_2013_left_heart_contractility_candidate.js');
const {
  K_MULTIPLIER,
  sourceSizingFromReference,
  solveLeftHeartPump2013,
}=require('../src/hummod_2013_left_heart_pump_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,tol=1e-7){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),
    a+' not near '+b);
}

const sizing=sourceSizingFromReference({
  sourceCardiacOutputMlPerMin:5000,
  leftHeartMassG:300,
  systemicArteryTotalVolumeMl:1000,
});

test('source pH and K-multiplier curve identities are preserved',()=>{
  near(contractilityHermite(PH_EFFECT,6.6),0);
  near(contractilityHermite(PH_EFFECT,6.75),1);
  near(contractilityHermite(PH_EFFECT,7.2),1);
  near(contractilityHermite(K_MULTIPLIER,0),0);
  near(contractilityHermite(K_MULTIPLIER,1),1);
  near(contractilityHermite(K_MULTIPLIER,3),1.3);
});

test('source sizing algebra reproduces reference stroke volume',()=>{
  near(sizing.strokeVolumeMl,5000/77);
  near(sizing.leftHeartEsvMl,0.175*300);
  near(sizing.leftHeartEdvMl,sizing.leftHeartEsvMl+sizing.strokeVolumeMl);
});

test('2013 implicit LV pump reproduces source-sized SBP and stroke at neutral contractility',()=>{
  const c=leftHeartContractility({
    cardiacGangliaHz:1.5,
    beta1PoolEffect:1.001,
    myocardialIntracellularPh:7.0,
    contractileProteinFunctionalRatio:1,
    digoxinPoolConcentration:0,
    anesthesiaHeartContractility:1,
    basic:1,
  });
  near(c.contractility,1,5e-3);
  const p=solveLeftHeartPump2013({
    meanArterialPressureMmHg:87,
    leftAtrialPressureMmHg:5.5,
    pericardialPressureMmHg:-4,
    heartRatePerMin:77,
    contractility:c.contractility,
    sourceSizing:sizing,
  });
  near(p.sbpMmHg,110,5e-3);
  near(p.strokeVolumeMl,sizing.strokeVolumeMl,5e-3);
  near(p.bloodFlowMlPerMin,5000,5e-3);
  assert.equal(p.canonicalControlAuthority,false);
});

test('intracellular acidosis lowers native HumMod LV contractility and forward output',()=>{
  const normalC=leftHeartContractility({
    cardiacGangliaHz:1.5,
    beta1PoolEffect:1.001,
    myocardialIntracellularPh:7.0,
  });
  const acidC=leftHeartContractility({
    cardiacGangliaHz:1.5,
    beta1PoolEffect:1.001,
    myocardialIntracellularPh:6.65,
  });
  assert(acidC.phEffect<normalC.phEffect);
  assert(acidC.contractility<normalC.contractility);

  const normal=solveLeftHeartPump2013({
    meanArterialPressureMmHg:87,
    leftAtrialPressureMmHg:5.5,
    pericardialPressureMmHg:-4,
    heartRatePerMin:77,
    contractility:normalC.contractility,
    sourceSizing:sizing,
  });
  const acid=solveLeftHeartPump2013({
    meanArterialPressureMmHg:87,
    leftAtrialPressureMmHg:5.5,
    pericardialPressureMmHg:-4,
    heartRatePerMin:77,
    contractility:acidC.contractility,
    sourceSizing:sizing,
  });
  assert(acid.strokeVolumeMl<normal.strokeVolumeMl);
  assert(acid.bloodFlowMlPerMin<normal.bloodFlowMlPerMin);
});

test('beta-adrenergic drive can oppose pH depression without changing pH equation',()=>{
  const lowBeta=leftHeartContractility({
    cardiacGangliaHz:1.5,
    beta1PoolEffect:1.001,
    myocardialIntracellularPh:6.70,
  });
  const highBeta=leftHeartContractility({
    cardiacGangliaHz:4.0,
    beta1PoolEffect:2.0,
    myocardialIntracellularPh:6.70,
  });
  assert.equal(highBeta.phEffect,lowBeta.phEffect);
  assert(highBeta.betaSymps>lowBeta.betaSymps);
  assert(highBeta.contractility>lowBeta.contractility);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
