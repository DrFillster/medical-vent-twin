'use strict';

const assert=require('node:assert/strict');
const {
  createHumModMyocardialAcidBaseRuntime,
}=require('../src/hummod_myocardial_acid_base_runtime.js');

const r=createHumModMyocardialAcidBaseRuntime({side:'left'});
const initial=r.snapshot();
assert.equal(initial.lactateMassMeq,0.17);
assert.equal(initial.co2MassMeq,3.5);
assert.equal(initial.sourceSolverIdentity,false);

const args={
  dtSec:0.1,
  intracellularPotassium:0.145,
  liquidVolumeMl:100,
  bloodFlowMlPerMin:250,
  o2UseMlPerMin:25,
  bloodSid:0.024,
  arterialHco3:0.024,
  anaerobicGlucoseUsedMgPerMin:0,
  lactateUsedMgPerMin:0,
  lactatePoolConcentration:0.0017,
};
const first=r.step(args);
assert(Number.isFinite(first.myocardialPco2MmHg));
assert(Number.isFinite(first.intracellularPh));
assert(first.timeSec===0.1);
assert.equal(first.controlAuthority,false);

const second=r.step({...args,anaerobicGlucoseUsedMgPerMin:2});
assert(second.lactate.nextMass!==first.lactate.nextMass);
assert(second.timeSec===0.2);
console.log('ok - myocardial acid-base runtime advances source lactate/CO2 masses with explicit upstream inputs');

assert.throws(
  ()=>r.step({...args,liquidVolumeMl:null}),
  /liquidVolumeMl/
);
console.log('ok - myocardial acid-base runtime does not invent missing water state');
