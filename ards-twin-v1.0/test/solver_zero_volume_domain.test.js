'use strict';

const assert = require('node:assert/strict');
const { buildSystem } = require('../src/mechanics.js');

// The analytic finite-capacity law is defined at zero. Its residual and
// Jacobian must stay consistent even when capacity falls below 1e-12 L.
for (const capacity of [1, 1e-10, 8.332214639397946e-13, 1e-14]) {
  const cp = { id: 'recruitable', capacity, elasticScale: 22 };
  const cs = { volume: 0, recruitment: 1 };
  const G = capacity;
  const dt = 0.002;
  const pressure = 5;
  const { F, J } = buildSystem(
    [{ cp, cs, G, idx: 0 }], [0], pressure,
    { kind: 'PRESSURE', pressureCmH2O: pressure },
    { airwayOpeningPressure: 0, centralAirwayResistance: 0 }, dt
  );
  assert(F.every(Number.isFinite));
  assert(J.flat().every(Number.isFinite));
  assert.equal(F[0], -dt * G * pressure, 'zero-volume elastic pressure is zero');
  assert(Math.abs(J[0][0] - (1 + dt * G * 22 / capacity)) < 1e-12,
    'zero-volume tangent is K/Vmax');
}
console.log('ok - zero-volume residual and tangent remain inside the finite-capacity domain');
