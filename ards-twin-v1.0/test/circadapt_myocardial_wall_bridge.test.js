'use strict';
const assert=require('node:assert/strict');
const {
  ventricularPressureFromFiberStress,
  myocardialToChamberContract,
}=require('../src/circadapt_myocardial_wall_bridge.js');

const blocked=myocardialToChamberContract({});
assert.equal(blocked.chamberPressureMmHg,null);
assert.equal(blocked.controlAuthority,false);
assert.match(blocked.status,/blocked/);

const x=ventricularPressureFromFiberStress({
  fiberStressMpa:0.1,
  wallVolumeMm3:100000,
  midwallAreaMm2:10000,
  midwallRadiusMm:30,
});
assert(Number.isFinite(x.chamberPressureMmHg));
assert(x.chamberPressureMmHg>0);
assert.equal(x.controlAuthority,false);
console.log('ok - CircAdapt/TriSeg wall bridge is deterministic and fail-closed without geometry');
