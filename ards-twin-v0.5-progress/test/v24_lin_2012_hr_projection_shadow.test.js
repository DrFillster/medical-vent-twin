'use strict';

const {
  createLin2012HrProjectionShadow,
}=require('../src/lin_2012_hr_projection_shadow.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}
function near(a,b,t=1e-9){assert(Math.abs(a-b)<=t,a+' != '+b);}

test('projection exactly preserves patient HR at declared reference state',()=>{
  const m=createLin2012HrProjectionShadow({
    patientReferenceHeartRatePerMin:75,
  });
  const s=m.evaluate({
    meanArterialPressureMmHg:82,
    arterialPo2MmHg:90,
    arterialPco2MmHg:40,
  });
  near(s.projectedHeartRatePerMin,75);
  near(s.sourceDeltaHeartRatePerMin,0);
  assert(s.controlAuthority===false);
  assert(s.dynamicAuthority===false);
});

test('high-MAP severe gas stress follows published Lin delta rather than empirical floor',()=>{
  const m=createLin2012HrProjectionShadow({
    patientReferenceHeartRatePerMin:75,
  });
  const s=m.evaluate({
    meanArterialPressureMmHg:104,
    arterialPo2MmHg:35,
    arterialPco2MmHg:110,
  });
  assert(s.sourceDeltaHeartRatePerMin>0,
    'published Lin equations should predict positive HR delta in severe gas stress despite MAP 104');
  assert(s.projectedHeartRatePerMin>75,
    'patient operating-point projection should preserve that positive source delta');
  assert(s.projectedHeartRatePerMin<100,
    'shadow should not silently reproduce the prior empirical ~99/min floor');
});

test('Lin gas interaction raises HR relative to normal gas at the same high MAP',()=>{
  const m=createLin2012HrProjectionShadow({
    patientReferenceHeartRatePerMin:75,
  });
  const normal=m.evaluate({
    meanArterialPressureMmHg:104,
    arterialPo2MmHg:90,
    arterialPco2MmHg:40,
  });
  const severe=m.evaluate({
    meanArterialPressureMmHg:104,
    arterialPo2MmHg:35,
    arterialPco2MmHg:110,
  });
  assert(severe.projectedHeartRatePerMin>normal.projectedHeartRatePerMin,
    'source baro-chemoreflex interaction should oppose pure high-MAP bradycardia');
});

const m=createLin2012HrProjectionShadow({
  patientReferenceHeartRatePerMin:75,
});
const rows=[60,70,80,90,100,104,110].map(map=>{
  const normal=m.evaluate({
    meanArterialPressureMmHg:map,
    arterialPo2MmHg:90,
    arterialPco2MmHg:40,
  });
  const severe=m.evaluate({
    meanArterialPressureMmHg:map,
    arterialPo2MmHg:35,
    arterialPco2MmHg:110,
  });
  return {
    map,
    normalProjectedHr:normal.projectedHeartRatePerMin,
    severeProjectedHr:severe.projectedHeartRatePerMin,
    severeLinAbsoluteHr:severe.sourceCurrentHeartRatePerMin,
    severeLinDeltaHr:severe.sourceDeltaHeartRatePerMin,
  };
});
console.log(JSON.stringify({rows},null,2));
console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
