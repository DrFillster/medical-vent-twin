'use strict';

const assert = require('node:assert/strict');
const {
  P,
  peripheralChemoreceptorStatic,
  pulmonaryStretchStatic,
  cnsHypoxiaStatic,
  peripheralSympatheticFiring,
  cardiacSympatheticFiring,
  vagalFiring,
  createUrsinoMagossoAutonomicShadow,
} = require('../src/ursino_magosso_autonomic_shadow.js');

function approx(actual, expected, tol, label) {
  assert.ok(Math.abs(actual - expected) <= tol,
    `${label}: expected ${expected}, got ${actual}`);
}

function test(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    console.error('FAIL - ' + name);
    console.error(err.stack || err.message);
    process.exitCode = 1;
  }
}

test('peripheral chemoreceptor approaches published minimum at high PaO2', () => {
  const v = peripheralChemoreceptorStatic(500);
  approx(v, P.peripheralChemoreceptor.fMinSpikesPerSec, 1e-5, 'high-PaO2 f_ac');
});

test('peripheral chemoreceptor approaches published maximum at severe hypoxia', () => {
  const v = peripheralChemoreceptorStatic(-500);
  approx(v, P.peripheralChemoreceptor.fMaxSpikesPerSec, 1e-5, 'low-PaO2 f_ac');
});

test('lung stretch uses actual VT linearly with published gain', () => {
  approx(pulmonaryStretchStatic(0.5), 11.645, 1e-12, 'f_ap');
});

test('CNS hypoxia channels remain distinct', () => {
  const sp = cnsHypoxiaStatic(35, 'sp');
  const sh = cnsHypoxiaStatic(35, 'sh');
  assert.notEqual(sp, sh);
});

test('shadow withholds efferent channels without source-valid f_ab', () => {
  const shadow = createUrsinoMagossoAutonomicShadow();
  const state = shadow.step({ dtSec: 1, pao2MmHg: 60, tidalVolumeL: 0.45 });
  assert.equal(state.fSpSpikesPerSec, null);
  assert.equal(state.fShSpikesPerSec, null);
  assert.equal(state.fVSpikesPerSec, null);
  assert.equal(state.baroreceptorMappingStatus, 'unmapped-no-source-valid-f_ab');
  assert.equal(state.active, false);
});

test('efferent equations evaluate only when explicit f_ab is supplied', () => {
  const args = {
    fAbSpikesPerSec: 25,
    fAcSpikesPerSec: 4,
    fApSpikesPerSec: 10,
    thetaSpSpikesPerSec: 10,
    thetaShSpikesPerSec: 2,
  };
  assert.ok(Number.isFinite(peripheralSympatheticFiring(args)));
  assert.ok(Number.isFinite(cardiacSympatheticFiring(args)));
  assert.ok(Number.isFinite(vagalFiring(args)));
});
