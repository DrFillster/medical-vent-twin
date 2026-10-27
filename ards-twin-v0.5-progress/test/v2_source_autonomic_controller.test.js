'use strict';

const {
  createV2SourceAutonomicController,
  severeHypercapniaContractilityMultiplier,
  hypercapnicSystemicResistanceRatio,
}=require('../src/v2_source_autonomic_controller.js');

const {
  P:ALBANESE_P,
}=require('../src/albanese_2016_autonomic_candidate.js');

const {
  P:URSINO_AUTONOMIC_P,
  vagalFiring,
}=require('../src/ursino_magosso_autonomic_shadow.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed+=1;}
  catch(e){console.error('FAIL -',name,':',e.message);failed+=1;}
}
function assert(cond,msg){if(!cond) throw new Error(msg||'assertion failed');}

function makeController(){
  return createV2SourceAutonomicController({
    baseline:{
      heartRatePerMin:75,
      systemicArterialConductanceMlPerMinPerMmHg:60,
      systemicVenousV0Ml:1700,
    },
  });
}

test('source-aligned controller returns finite projected v1.0 effectors',()=>{
  const c=makeController();
  let s;
  for(let i=0;i<2000;i++){
    s=c.step({
      dtSec:0.01,
      meanArterialPressureMmHg:82,
      tidalVolumeL:0.42,
      arterialPo2MmHg:90,
      arterialPco2MmHg:40,
      arterialPh:7.40,
    });
  }
  [
    s.heartRatePerMin,
    s.leftContractilityMultiplier,
    s.rightContractilityMultiplier,
    s.systemicArterialConductanceMlPerMinPerMmHg,
    s.systemicVenousV0Ml,
    s.afferents.fAbSpikesPerSec,
    s.afferents.fAcSpikesPerSec,
    s.autonomic.fSpSpikesPerSec,
    s.autonomic.fShSpikesPerSec,
    s.autonomic.fVSpikesPerSec,
  ].forEach(v=>assert(Number.isFinite(v),'expected finite source control output'));
  assert(s.provenance.authority==='v2.4-albanese-integrated-source-controller');
});

test('hypoxemia changes source autonomic and cardiac outputs',()=>{
  const c=makeController();
  let normal;
  for(let i=0;i<1000;i++){
    normal=c.step({
      dtSec:0.01,
      meanArterialPressureMmHg:82,
      tidalVolumeL:0.42,
      arterialPo2MmHg:90,
      arterialPco2MmHg:40,
      arterialPh:7.40,
    });
  }
  let hypoxic;
  for(let i=0;i<3000;i++){
    hypoxic=c.step({
      dtSec:0.01,
      meanArterialPressureMmHg:70,
      tidalVolumeL:0.42,
      arterialPo2MmHg:35,
      arterialPco2MmHg:40,
      arterialPh:7.40,
    });
  }
  assert(Math.abs(hypoxic.afferents.fAcSpikesPerSec-
    normal.afferents.fAcSpikesPerSec)>0.01,
    'chemoreceptor output should change');
  assert(Math.abs(hypoxic.heartRatePerMin-normal.heartRatePerMin)>0.1,
    'heart rate should change');
  assert(Math.abs(hypoxic.systemicArterialConductanceMlPerMinPerMmHg-
    normal.systemicArterialConductanceMlPerMinPerMmHg)>0.001,
    'systemic conductance should change');
});

test('respiratory acidemia applies independently sourced negative inotropy',()=>{
  const c=makeController();
  let s;
  for(let i=0;i<2000;i++){
    s=c.step({
      dtSec:0.01,
      meanArterialPressureMmHg:82,
      tidalVolumeL:0.42,
      arterialPo2MmHg:80,
      arterialPco2MmHg:100,
      arterialPh:7.10,
    });
  }
  assert(s.acidoticContractilityMultiplier<1,
    'severe respiratory acidemia should reduce the direct inotropy multiplier');
  assert(s.acidoticContractilityMultiplier>=0.45-1e-9,
    'bounded source anchor must not extrapolate below the published challenge');
});

test('severe hypercapnia remains bounded by published myocardial anchors',()=>{
  const normal=severeHypercapniaContractilityMultiplier(45);
  const dog=severeHypercapniaContractilityMultiplier(92);
  const severe=severeHypercapniaContractilityMultiplier(146);
  const extreme=severeHypercapniaContractilityMultiplier(400);
  assert(Math.abs(normal-1)<1e-12);
  assert(dog<1&&dog>severe);
  assert(Math.abs(severe-0.20)<1e-12);
  assert(Math.abs(extreme-0.20)<1e-12,
    'must not extrapolate beyond isolated-heart severe anchor');
});

test('hypercapnic systemic vasodilation is bounded at the swine anchor',()=>{
  const normal=hypercapnicSystemicResistanceRatio(45);
  const challenge=hypercapnicSystemicResistanceRatio(110);
  const extreme=hypercapnicSystemicResistanceRatio(400);
  assert(Math.abs(normal-1)<1e-12);
  assert(challenge<1&&challenge>0);
  assert(Math.abs(extreme-challenge)<1e-12,
    'must not extrapolate SVR below the published hypercapnia anchor');
});


test('published vagal sigmoid approaches source asymptotes without additive f_v0 bias',()=>{
  const p=URSINO_AUTONOMIC_P.vagal;
  const low=vagalFiring({
    fAbSpikesPerSec:-1000,
    fAcSpikesPerSec:0,
    fApSpikesPerSec:0,
  });
  const high=vagalFiring({
    fAbSpikesPerSec:1000,
    fAcSpikesPerSec:0,
    fApSpikesPerSec:0,
  });
  assert(Math.abs(low-(p.f0SpikesPerSec-p.thetaSpikesPerSec))<1e-9,
    'low-baroreceptor limit must approach f_v0 minus theta');
  assert(Math.abs(high-(p.fInfinitySpikesPerSec-p.thetaSpikesPerSec))<1e-9,
    'high-baroreceptor limit must approach f_vInfinity minus theta, not f_v0 + f_vInfinity');
});

test('Ursino/Magosso vagal sigmoid preserves published high-baroreceptor asymptote',()=>{
  const {P:UM_P,vagalFiring}=require('../src/ursino_magosso_autonomic_shadow.js');
  const fAc=0;
  const fAp=0;
  const high=vagalFiring({
    fAbSpikesPerSec:1000,
    fAcSpikesPerSec:fAc,
    fApSpikesPerSec:fAp,
  });
  const expected=UM_P.vagal.fInfinitySpikesPerSec-UM_P.vagal.thetaSpikesPerSec;
  assert(Math.abs(high-expected)<1e-6,
    'high-baroreceptor vagal output must approach fInfinity - theta, not f0 + fInfinity - theta');
});

test('Albanese 2016 Table 7 cardiovascular-control calibration is active',()=>{
  assert(Math.abs(ALBANESE_P.lungStretch.gainSpikesPerSecPerL-11.76)<1e-12);
  assert(Math.abs(ALBANESE_P.sympathetic.weights.p.baro-(-1.1375))<1e-12);
  assert(Math.abs(ALBANESE_P.sympathetic.weights.p.chemo-1.716)<1e-12);
  assert(Math.abs(ALBANESE_P.sympathetic.weights.p.pulmonary-(-0.3997))<1e-12);
  assert(Math.abs(ALBANESE_P.sympathetic.weights.v.baro-(-1.0806))<1e-12);
  assert(Math.abs(ALBANESE_P.sympathetic.weights.v.pulmonary-(-0.2907))<1e-12);
  assert(Math.abs(ALBANESE_P.sympathetic.weights.h.baro-(-1.75))<1e-12);
});

test('controller applies HumMod 2012/2013 SA-node chronotropy and keeps Albanese HR comparator-only',()=>{
  const c=makeController();
  let s;
  for(let i=0;i<600;i++){
    s=c.step({
      dtSec:0.1,
      meanArterialPressureMmHg:82,
      tidalVolumeL:0.42,
      arterialPo2MmHg:90,
      arterialPco2MmHg:40,
      arterialPh:7.40,
    });
  }
  for(let i=0;i<1200;i++){
    s=c.step({
      dtSec:0.1,
      meanArterialPressureMmHg:104,
      tidalVolumeL:0.10,
      arterialPo2MmHg:35,
      arterialPco2MmHg:110,
      arterialPh:6.90,
    });
  }
  assert(Math.abs(s.heartRatePerMin-s.hummod2013HeartRatePerMin)<1e-12,
    'applied HR must equal HumMod 2012/2013 SA-node HR');
  assert(Math.abs(s.albaneseComparatorHeartRatePerMin-s.sourceHeartRatePerMin)<1e-12,
    'Albanese HR must remain comparator-only');
  assert(Math.abs(s.appliedHeartPeriodSec-(60/s.heartRatePerMin))<1e-12,
    'applied heart period must derive from the active HumMod SA-node HR');
  assert(s.chronotropyOwner.includes('HumMod 2012/2013'));
  assert(Number.isFinite(s.chronotropy.catecholamines.nePgPerMl));
  assert(Number.isFinite(s.chronotropy.catecholamines.epiPgPerMl));
  assert(Number.isFinite(s.chronotropy.catecholamines.beta1Effect));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
