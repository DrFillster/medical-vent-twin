'use strict';

const assert=require('node:assert/strict');
const {
  setupHgbProps,
}=require('../src/hummod_hgb_tissue_source_aligned.js');
const {
  createHumModMyocardialDecompensationObserver,
}=require('../src/hummod_myocardial_decompensation_observer.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

function fixture(arterialPo2MmHg=90){
  const h=setupHgbProps({
    tempC:37,
    pH:7.35,
    pCO2MmHg:45,
    carboxyPercent:0.4,
  });
  return {
    dtSec:0.1,
    arterialPo2MmHg,
    pressureGradientMmHg:90,
    alphaReceptorActivity:1,
    adhPoolLog10Conc:0.8,
    myocardialMassG:300,
    initialMyocardialMassG:300,
    calMultiplier:1,
    thyroidEffect:1,
    heatMetabolismCore:1,
    structureEffect:1,
    viscosityConductanceEffect:1,
    anesthesiaVascularConductance:1,
    vasculatureEffect:1,
    infarctionEffect:1,
    arterialO2ContentMlPerMl:0.19,
    o2MaxMlPerMl:0.20,
    hgbP50:h.p50,
    hgbScaleForSat:h.scaleForSat,
    plasmaVolumeFraction:0.55,
    fattyAcidConcentrationMgPerMl:0.0016,
    fattyAcidConcentrationMgDl:0.16,
    glucoseConcentrationMgPerMl:0.011,
    glucoseConcentrationMgDl:1.10,
    myocardialLactateMgDlForFuel:10,
    intracellularPotassium:0.145,
    liquidVolumeMl:100,
    bloodSid:0.024,
    arterialHco3:0.024,
    lactatePoolConcentration:0.0017,
  };
}

test('observer composes source modules without whole-heart authority',()=>{
  const o=createHumModMyocardialDecompensationObserver({side:'left'});
  const s=o.step(fixture());
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.canonicalControlAuthority,false);
  assert.equal(s.controlAuthority,false);
  assert(Number.isFinite(s.coronary.bloodFlowMlPerMin));
  assert(Number.isFinite(s.metabolism.o2NeedMlPerMin));
  assert(Number.isFinite(s.fuel.minimumFractionalDelivery));
  assert(Number.isFinite(s.acidBase.intracellularPh));
  assert.equal(s.wholeHeart.contractilityMultiplier,null);
  assert.equal(s.wholeHeart.emax,null);
  assert.equal(s.wholeHeart.strokeVolumeEffect,null);
  assert.equal(s.wholeHeart.cardiacOutputEffect,null);
});

test('lower arterial PO2 changes myocardial oxygen state but does not create Emax authority',()=>{
  const normal=createHumModMyocardialDecompensationObserver({side:'left'});
  const low=createHumModMyocardialDecompensationObserver({side:'left'});
  const a=normal.step(fixture(90));
  const b=low.step(fixture(20));
  assert(b.coronary.po2MmHg<=a.coronary.po2MmHg);
  assert(b.coronary.aerobicFraction<=a.coronary.aerobicFraction);
  assert(b.metabolism.o2UseMlPerMin<=a.metabolism.o2UseMlPerMin);
  assert.equal(b.wholeHeart.contractilityMultiplier,null);
});

test('observer fails closed on missing upstream state',()=>{
  const o=createHumModMyocardialDecompensationObserver({side:'left'});
  const x=fixture();
  delete x.intracellularPotassium;
  assert.throws(()=>o.step(x),/intracellularPotassium/);
});

test('cellular energetic fields remain incomplete when not supplied',()=>{
  const o=createHumModMyocardialDecompensationObserver({side:'left'});
  const s=o.step(fixture());
  assert.match(s.blockers.intracellularEnergetics,/not supplied/i);
  assert.equal(s.cellular.wholeHeartContractilityMultiplier,null);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
