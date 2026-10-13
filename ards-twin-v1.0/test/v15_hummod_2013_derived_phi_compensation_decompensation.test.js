'use strict';

const assert=require('node:assert/strict');
const {
  initialLeftHeartMass2013,
}=require('../src/hummod_2013_left_heart_mass_provider.js');
const {
  sourceSizingFromReference,
}=require('../src/hummod_2013_left_heart_pump_candidate.js');
const {
  createHumMod2013DerivedPhiCompensationDecompensationCandidate,
}=require('../src/hummod_2013_derived_phi_compensation_decompensation_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,tol=1e-8){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),
    a+' not near '+b);
}

const lv=initialLeftHeartMass2013({
  sex:'male',
  index:1,
  ageYears:30,
  plusMinusPercent:0,
  stochasmPercent:0,
});

const sizing=sourceSizingFromReference({
  sourceCardiacOutputMlPerMin:5000,
  leftHeartMassG:lv.initialLeftHeartMassG,
  systemicArteryTotalVolumeMl:1000,
});

function make(){
  return createHumMod2013DerivedPhiCompensationDecompensationCandidate({
    ecfvMl:15000,
    sourceSizing:sizing,
    initialLeftHeartMassG:lv.initialLeftHeartMassG,
    initialLeftHeartLiquidVolumeMl:lv.initialLeftHeartLiquidVolumeMl,
    initialArterialPh:7.44,
  });
}

const BASE=Object.freeze({
  dtSec:0.1,
  arterialPo2MmHg:94,
  arterialPh:7.44,
  arterialPco2MmHg:40,
  arterialO2ContentMlPerMl:0.19,
  arterialHco3:0.024,
  bloodSid:0.040,
  bloodTempC:37,
  carboxyPercent:0,

  meanArterialPressureMmHg:87,
  systemicVenousPressureMmHg:5,
  leftAtrialPressureMmHg:5.5,
  pericardialPressureMmHg:-4,

  myocardialMassG:lv.initialLeftHeartMassG,
  myocardialLiquidVolumeMl:lv.initialLeftHeartLiquidVolumeMl,
  intracellularPotassium:0.145,
  hematocritFraction:0.44,
  adhPoolLog10Conc:0.8,
  insulinReceptorBoundFractionPercent:8,
  glucosePoolMgPerMl:1.10,
  fattyAcidPoolMgPerMl:0.160,
  lactatePoolMeqPerMl:0.0017,
  thyroidPoolTotalT4T3:8,
  coreTempC:37,

  calMultiplier:1,
  anesthesiaVascularConductance:1,
  vasculatureEffect:1,
  infarctionEffect:1,
  contractileProteinFunctionalRatio:1,
  digoxinPoolConcentration:0,
  anesthesiaHeartContractility:1,
  basicContractility:1,
  stiffness:1,
  systolicX:1,
  mitralStenosisEffect:1,
  aorticStenosisEffect:1,
  mitralRegurgitationEffect:1,
  aorticRegurgitationEffect:1,
  respiratoryQuotient:0.8,
});

test('candidate derives finite myocardial pHi and remains noncanonical',()=>{
  const c=make();
  const s=c.step(BASE);
  assert(Number.isFinite(s.myocardialIntracellularPh));
  assert(Number.isFinite(s.coronaryFlow.bloodFlowMlPerMin));
  assert(Number.isFinite(s.leftHeartContractility.contractility));
  assert(Number.isFinite(s.strokeVolumeMl));
  assert(Number.isFinite(s.cardiacOutputMlPerMin));
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.canonicalControlAuthority,false);
  assert.equal(s.controlAuthority,false);
});

test('external myocardial-pHi coordinate cannot override derived pHi',()=>{
  const a=make();
  const b=make();
  const sa=a.step({...BASE,myocardialIntracellularPh:6.5});
  const sb=b.step({...BASE,myocardialIntracellularPh:7.4});
  near(sa.myocardialIntracellularPh,sb.myocardialIntracellularPh);
  near(
    sa.leftHeartContractility.contractility,
    sb.leftHeartContractility.contractility
  );
});

test('2013 whole-heart candidate preserves zero anaerobic glucose/lactate production',()=>{
  const c=make();
  const s=c.step(BASE);
  assert.equal(s.acidBase.fuel.anaerobicGlucoseUsedCalsPerMin,0);
  assert.equal(s.acidBase.fuel.anaerobicGlucoseUsedMgPerMin,0);
  near(s.acidBase.lactate.madeMgPerMin,0);
});

test('unresolved myocardial providers fail closed',()=>{
  for(const field of [
    'adhPoolLog10Conc',
    'intracellularPotassium',
    'myocardialLiquidVolumeMl',
    'insulinReceptorBoundFractionPercent',
    'thyroidPoolTotalT4T3',
  ]){
    const c=make();
    const x={...BASE};
    delete x[field];
    assert.throws(()=>c.step(x),new RegExp(field));
  }
});

test('composed derived-pHi candidate converges with timestep refinement',()=>{
  function run(dtSec){
    const c=make();
    const n=Math.round(60/dtSec);
    for(let i=0;i<n;i++) c.step({...BASE,dtSec});
    return c.snapshot();
  }
  const coarse=run(1);
  const medium=run(0.2);
  const fine=run(0.1);
  assert(
    Math.abs(medium.myocardialIntracellularPh-fine.myocardialIntracellularPh) <
    Math.abs(coarse.myocardialIntracellularPh-fine.myocardialIntracellularPh)
  );
  assert(
    Math.abs(medium.heartRatePerMin-fine.heartRatePerMin) <
    Math.abs(coarse.heartRatePerMin-fine.heartRatePerMin)+1e-9
  );
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
