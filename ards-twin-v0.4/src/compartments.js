// compartments.js — per-compartment elastic recoil law.
//
// Law (linear, with hard saturation):
//   P = V × elasticScale / (capacity × capMult(recruitment)) + AOP
//   P is finite-clipped at 1e4 cmH2O above.
//
// capacity and elasticScale jointly define linear compliance C:
//   C (L/cmH2O) = capacity / elasticScale
// so P = V / C + AOP. Recruitment scales the saturation capacity
// multiplicatively via capMult(recruitment); at recruitment=0 the
// compartment contributes a baseline capacity, at recruitment=1 it
// expands up to fN_max × its initial capacity.
//
// Recruitable compartments with capacity ≈ 0 are still treated as
// placeholders (don't participate in mechanics) so the FLOW solve
// remains stable. A truly-recruited compartment must be given a
// non-zero baseline capacity for the dynamics to take effect.

const { capacityMultiplier } = require('./recruitment.js');

const MAX_PRESSURE = 1e4;

function effectiveCapacity(params, recruitment) {
  return params.capacity * capacityMultiplier(recruitment, params.fN_max || 2.0);
}

function elasticPressure(volume, params, recruitment = 0, aop = 0) {
  // Compartment with effectively zero baseline capacity is a placeholder
  // (e.g. an un-recruited recruitable compartment). It does not
  // contribute to mechanics — its elastic pressure would otherwise
  // blow up at any tiny float-residual volume.
  if (params.capacity <= 1e-12) return aop;
  const cap = effectiveCapacity(params, recruitment);
  const K = Math.max(params.elasticScale, 1e-9);
  if (volume < 1e-9) return aop;
  let p = aop + volume * K / cap;
  if (p > MAX_PRESSURE) p = MAX_PRESSURE;
  return p;
}

// Cap raw compartment volume before update; protects against FP overflow
// in the FLOW-boundary linear solve. The cap scales with recruitment so
// a recruited compartment has higher saturation asymptote.
function clampVolume(volume, params, recruitment = 0) {
  const cap = effectiveCapacity(params, recruitment);
  if (volume > 1000 * cap) return 1000 * cap;
  if (volume < 0) return 0;
  return volume;
}

module.exports = { elasticPressure, clampVolume, effectiveCapacity };
