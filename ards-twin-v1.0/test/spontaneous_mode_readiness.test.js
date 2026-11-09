'use strict';

const assert = require('node:assert/strict');
const {
  assessSpontaneousModeReadiness,
} = require('../src/spontaneous_mode_readiness.js');

const liveSystemic = {
  gasExchange: {
    paco2MmHg: 40,
    pao2MmHg: 90,
    pH: 7.40,
    arterialHco3MmolPerL: 24,
  },
  hemodynamics: {
    brainBloodFlowMlPerMin: 750,
  },
};

const current = assessSpontaneousModeReadiness({
  systemic: liveSystemic,
  components: {
    effortMechanics: true,
    mechanicalReflexes: true,
    psController: true,
    simvController: true,
  },
});

assert.equal(current.psCpapReady, false);
assert.equal(current.simvReady, false);
assert.equal(current.publicActivationAllowed, false);
assert.deepEqual(
  current.blockers.map(b => b.key),
  [
    'brainCo2LocalState',
    'medullaryAcidBase',
    'peripheralCo2PhGain',
  ]
);

const ready = assessSpontaneousModeReadiness({
  systemic: liveSystemic,
  brainLocalState: {
    pH: 7.34,
    virtualO2SaturationFraction: 0.75,
  },
  medullaryBicarbonateMmolPerL: 24,
  gPco2Ph: 1,
  components: {
    effortMechanics: true,
    mechanicalReflexes: true,
    psController: true,
    simvController: true,
  },
});

assert.equal(ready.shadowRunnable, true);
assert.equal(ready.sourceAuthorityReady, true);
assert.equal(ready.psCpapReady, true);
assert.equal(ready.simvReady, true);
assert.equal(ready.publicActivationAllowed, true);
assert.deepEqual(ready.blockers, []);

const interpretedShadow = assessSpontaneousModeReadiness({
  systemic: liveSystemic,
  brainLocalState: {
    pH: 7.34,
    virtualO2SaturationFraction: 0.75,
  },
  medullaryBicarbonateMmolPerL: 24,
  gPco2Ph: 1,
  boundaryAuthority: 'interpretation-not-source-exact',
  gainAuthority: 'calibrated-not-source-exact',
  components: {
    effortMechanics: true,
    mechanicalReflexes: true,
    psController: true,
    simvController: true,
  },
});
assert.equal(interpretedShadow.shadowRunnable, true);
assert.equal(interpretedShadow.sourceAuthorityReady, false);
assert.equal(interpretedShadow.psCpapReady, false);
assert.equal(interpretedShadow.simvReady, false);
assert.equal(interpretedShadow.publicActivationAllowed, false);

const missingFlow = assessSpontaneousModeReadiness({
  systemic: {
    gasExchange: liveSystemic.gasExchange,
    hemodynamics: {},
  },
  brainLocalState: {
    pH: 7.34,
    virtualO2SaturationFraction: 0.75,
  },
  medullaryBicarbonateMmolPerL: 24,
  gPco2Ph: 1,
  components: {
    effortMechanics: true,
    mechanicalReflexes: true,
    psController: true,
    simvController: true,
  },
});
assert(missingFlow.blockers.some(b => b.key === 'cerebralFlow'));

console.log('ok - spontaneous mode readiness fails closed on unresolved live drive boundaries');
console.log(JSON.stringify(current, null, 2));
