'use strict';
const {
  SOURCE,CURVES,hermite,solveBrainFlow,createHumModSourceAlignedBrainHypoxia,
}=require('../src/hummod_brain_hypoxia_source_aligned.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function near(a,b,t=1e-9){assert(Math.abs(a-b)<=t,a+' not near '+b);}

test('preserves native Brain-Flow and BrainInsult constants',()=>{
  near(SOURCE.brainFlowBasicConductance,9.1);
  near(SOURCE.brainFlowErrorLimitMmHg,0.37);
  near(SOURCE.brainPo2DelayKPerMin,4);
  near(hermite(CURVES.brainInsultPo2Effect,10),0);
  near(hermite(CURVES.brainInsultPo2Effect,30),1);
});

test('run06 baseline brain flow replay is within native implicit tolerance',()=>{
  const s=solveBrainFlow({
    arterialPo2MmHg:94.009870530838,
    arterialO2ContentMlPerMl:0.196,
    o2MaxMlPerMl:0.200216828201916,
    arterialPh:7.4,
    arterialPco2MmHg:40.3937738764693,
    carboxyPercent:0.389637710489589,
    tempC:37,
    pressureGradientMmHg:89.3625792967117,
    brainPco2MmHg:46.5805596402771,
    o2NeedMlPerMin:39.3065407483815,
  });
  assert(Math.abs(s.po2MmHg-40.3699717617139)<=0.37,
    'brain tissue PO2 replay must be within HumMod error limit');
});

test('severe arterial hypoxemia produces low brain tissue PO2',()=>{
  const s=solveBrainFlow({
    arterialPo2MmHg:14.066113617021,
    arterialO2ContentMlPerMl:0.0360374485928025,
    o2MaxMlPerMl:0.199888902293675,
    arterialPh:7.36,
    arterialPco2MmHg:46.4076209589509,
    carboxyPercent:0.390941669136932,
    tempC:37.03,
    pressureGradientMmHg:55.4181007568852,
    brainPco2MmHg:51.1215816129238,
    o2NeedMlPerMin:39.5553369473497,
  });
  assert(s.po2MmHg<20,'brain tissue PO2 should be severely reduced');
});

test('BrainInsult PO2 delay reproduces source direction and threshold behavior',()=>{
  const b=createHumModSourceAlignedBrainHypoxia();
  let s;
  for(let i=0;i<180;i++){
    s=b.step({
      dtSec:1,
      arterialPo2MmHg:14,
      arterialO2ContentMlPerMl:0.036,
      o2MaxMlPerMl:0.2,
      arterialPh:7.36,
      arterialPco2MmHg:46,
      carboxyPercent:0.39,
      tempC:37,
      pressureGradientMmHg:55,
      brainPco2MmHg:51,
      o2NeedMlPerMin:39.5,
    });
  }
  assert(s.po2DelayMmHg<30);
  assert(s.brainFunctionEffect<1);
  assert(s.provenance.empiricalArterialPo2ToHrShortcut===false);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
