'use strict';

const assert=require('node:assert/strict');
const {
  SOURCE,P,
  oxygenDissociationFactor,
  arterialO2ConcentrationMmolPerL,
  venousO2ConcentrationSameUnits,
  heartO2ConsumptionMlPerSec,
  instantaneousCardiacPumpPowerMmHgMlPerSec,
  averageCardiacPumpPowerDerivative,
}=require('../src/ursino_magosso_2000_oxygen_metabolic_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function close(a,b,tol=1e-12){
  return Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b));
}

test('source identity and Table 3 values are pinned',()=>{
  assert.equal(SOURCE.doi,'10.1152/ajpheart.2000.279.1.H149');
  assert.deepEqual(SOURCE.equations,[43,44,45,46,47,48]);
  assert.equal(P.dissociation.saturationConcentrationMmolPerL,9);
  assert.equal(P.dissociation.exponentA,0.3836);
  assert.equal(P.dissociation.alphaPerMmHg,0.03198);
  assert.equal(P.dissociation.betaPerMmHg,0.008275);
  assert.equal(P.dissociation.KmmHg,14.99);
  assert.equal(P.metabolism.muscleO2ConsumptionMlPerSec,0.86);
  assert.equal(P.metabolism.brainO2ConsumptionMlPerSec,0.7917);
  assert.equal(P.metabolism.heartBasalO2ConsumptionMlPerSec,0.4);
  assert.equal(P.metabolism.heartBasalPowerMmHgMlPerSec,12660);
  assert.equal(P.metabolism.cardiacPowerTauSec,5);
});

test('Eq 44 arterial O2 concentration increases monotonically with PaO2',()=>{
  const severe=arterialO2ConcentrationMmolPerL({
    pao2MmHg:30,paco2MmHg:40,
  });
  const moderate=arterialO2ConcentrationMmolPerL({
    pao2MmHg:50,paco2MmHg:40,
  });
  const normal=arterialO2ConcentrationMmolPerL({
    pao2MmHg:100,paco2MmHg:40,
  });
  assert(severe<moderate);
  assert(moderate<normal);
  assert(normal<P.dissociation.saturationConcentrationMmolPerL);
});

test('Eq 43 same-unit extraction mass balance is exact',()=>{
  const cv=venousO2ConcentrationSameUnits({
    arterialO2Concentration:0.2,
    oxygenConsumptionPerSec:0.8,
    bloodFlowPerSec:20,
  });
  assert(close(cv,0.16));
});

test('Eq 46 reproduces basal myocardial O2 consumption at basal power',()=>{
  assert(close(
    heartO2ConsumptionMlPerSec({
      averagePumpPowerMmHgMlPerSec:12660,
    }),
    0.4
  ));
  assert(
    heartO2ConsumptionMlPerSec({
      averagePumpPowerMmHgMlPerSec:25320,
    })>
    P.metabolism.heartBasalO2ConsumptionMlPerSec
  );
});

test('Eqs 47-48 retain pump-work sign and low-pass direction',()=>{
  const w=instantaneousCardiacPumpPowerMmHgMlPerSec({
    leftVentriclePressureMmHg:100,
    dLeftVentricleVolumeDtMlPerSec:-80,
    rightVentriclePressureMmHg:20,
    dRightVentricleVolumeDtMlPerSec:-80,
  });
  assert(w>0);
  assert(averageCardiacPumpPowerDerivative({
    instantaneousPumpPowerMmHgMlPerSec:w,
    averagePumpPowerMmHgMlPerSec:1000,
  })>0);
});

test('unit boundary stays explicit instead of silently converting Eq 44 into Eq 43 units',()=>{
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      P.dissociation,'saturationConcentrationMlO2PerMlBlood'
    ),
    false
  );
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
