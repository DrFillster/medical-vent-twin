'use strict';

const assert=require('node:assert/strict');
const {
  createStatefulShimayoshiAcidosisPressureShadow,
}=require('../src/shimayoshi_acidosis_stateful_pressure_shadow.js');

const x=createStatefulShimayoshiAcidosisPressureShadow();

const challenge=x.evaluate({
  myocardialPco2MmHg:158,
  phase:'challenge',
  phaseElapsedSec:100,
  lvVolumeMl:120,
});
assert.equal(challenge.pressureShadowEligible,true);
assert.equal(challenge.closedLoopPressureAuthority,false);
assert(Number.isFinite(challenge.lvPressureMmHg));

const recovery=x.evaluate({
  myocardialPco2MmHg:40,
  phase:'recovery',
  phaseElapsedSec:20,
  lvVolumeMl:120,
});
assert.equal(recovery.pressureShadowEligible,true);
assert.equal(recovery.history.lookupMyocardialPco2MmHg,158);
assert.equal(recovery.history.currentMyocardialPco2MmHg,40);
assert(Number.isFinite(recovery.lvPressureMmHg));
console.log('ok - stateful recovery preserves preceding fixed challenge identity');

const changed=createStatefulShimayoshiAcidosisPressureShadow();
changed.evaluate({
  myocardialPco2MmHg:118.5,
  phase:'challenge',
  phaseElapsedSec:10,
  lvVolumeMl:120,
});
const blocked=changed.evaluate({
  myocardialPco2MmHg:197.5,
  phase:'challenge',
  phaseElapsedSec:20,
  lvVolumeMl:120,
});
assert.equal(blocked.pressureShadowEligible,false);
assert.equal(blocked.lvPressureMmHg,null);
assert.match(blocked.status,/dynamic-myocardial-CO2-history/);
console.log('ok - live pressure shadow fails closed after changing challenge PCO2');

assert.throws(
  ()=>x.evaluate({
    myocardialPco2MmHg:40,
    phase:'recovery',
    phaseElapsedSec:61,
    lvVolumeMl:120,
  }),
  /validated 60 s/
);
console.log('ok - live pressure shadow refuses source-time extrapolation');
