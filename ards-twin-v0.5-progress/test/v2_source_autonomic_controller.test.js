'use strict';

const {
  createV2SourceAutonomicController,
  severeHypercapniaContractilityMultiplier,
  hypercapnicSystemicResistanceRatio,
}=require('../src/v2_source_autonomic_controller.js');

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
  assert(s.provenance.authority==='v2.0-source-aligned-reduced-controller');
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

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
