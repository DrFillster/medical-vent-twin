'use strict';

const assert=require('node:assert/strict');
const {
  createHumModBloodOxygenProviderCandidate,
}=require('../src/hummod_blood_oxygen_provider_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,tol=1e-10){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),
    a+' not near '+b);
}

test('provider requires explicit initialization and is noncanonical',()=>{
  assert.throws(
    ()=>createHumModBloodOxygenProviderCandidate({}),
    /initialBloodVolumeMl/
  );
  const p=createHumModBloodOxygenProviderCandidate({
    initialBloodVolumeMl:5400,
    initialHematocritFraction:0.44,
  });
  const s=p.snapshot();
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.controlAuthority,false);
  near(s.hematocritFraction,0.44);
  near(s.plasmaVolumeFraction,0.56);
  near(s.viscosityConductanceEffect,1);
});

test('isovolemic source-balanced blood state preserves hematocrit',()=>{
  const p=createHumModBloodOxygenProviderCandidate({
    initialBloodVolumeMl:5400,
    initialHematocritFraction:0.44,
  });
  const a=p.snapshot();
  const b=p.step({
    dtSec:60,
    rbcGainMlPerMin:0,
    plasmaGainMlPerMin:0,
  });
  near(b.hematocritFraction,a.hematocritFraction);
  near(b.o2MaxMlPerMl,a.o2MaxMlPerMl);
  near(b.viscosityConductanceEffect,a.viscosityConductanceEffect);
});

test('whole-blood hemorrhage preserves hematocrit when no replacement is supplied',()=>{
  const p=createHumModBloodOxygenProviderCandidate({
    initialBloodVolumeMl:5400,
    initialHematocritFraction:0.44,
  });
  const a=p.snapshot();
  const b=p.step({
    dtSec:60,
    hemorrhageSwitch:true,
    hemorrhageTargetRateMlPerMin:100,
  });
  assert(b.bloodVolume.bloodVolumeMl<a.bloodVolume.bloodVolumeMl);
  near(b.hematocritFraction,a.hematocritFraction,1e-9);
  near(b.o2MaxMlPerMl,a.o2MaxMlPerMl,1e-9);
});

test('plasma-only gain lowers hematocrit, viscosity, and O2 capacity through source providers',()=>{
  const p=createHumModBloodOxygenProviderCandidate({
    initialBloodVolumeMl:5400,
    initialHematocritFraction:0.44,
  });
  const a=p.snapshot();
  const b=p.step({
    dtSec:60,
    plasmaGainMlPerMin:500,
  });
  assert(b.hematocritFraction<a.hematocritFraction);
  assert(b.plasmaVolumeFraction>a.plasmaVolumeFraction);
  assert(b.o2MaxMlPerMl<a.o2MaxMlPerMl);
  assert(b.viscosityValue<a.viscosityValue);
  assert(b.viscosityConductanceEffect>a.viscosityConductanceEffect);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
