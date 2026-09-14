// compartments.js — per-compartment elastic recoil law.
//
// Law (linear, with hard saturation):
//   P = V × elasticScale / capacity + AOP           (V ≤ maxSafeVolume)
//   P is finite-clipped at 1e4 cmH2O above.
//
// capacity and elasticScale jointly define linear compliance C:
//   C (L/cmH2O) = capacity / elasticScale
// so P = V / C + AOP. This matches the single-RC analytic V_eq = C × Paw
// in the linear-RC test, and the rc1 reference convention where
// capacity = cK and elasticScale = K (so capacity/elasticScale = c, the
// linear compliance scaling).
//
// maxSafeVolume caps V to a hard saturation asymptote (set to 1.5 × capacity
// in clampVolume). This avoids unbounded growth under sustained high Paw
// without changing the analytic V_eq in the operating range.

const MAX_PRESSURE = 1e4;

function elasticPressure(volume, params, _recruitment, aop = 0) {
  // Compartment with effectively zero capacity is a placeholder
  // (e.g. an un-recruited recruitable compartment). It does not
  // contribute to mechanics — its elastic pressure would otherwise
  // blow up at any tiny float-residual volume.
  if (params.capacity <= 1e-12) return aop;
  const cap = params.capacity;
  const K = Math.max(params.elasticScale, 1e-9);
  if (volume < 1e-9) return aop;
  let p = aop + volume * K / cap;
  if (p > MAX_PRESSURE) p = MAX_PRESSURE;
  return p;
}

// Cap raw compartment volume before update; protects against FP overflow
// in the FLOW-boundary linear solve. Allow up to 1000× capacity so the
// linear-RC analytic V_eq (V = C × Paw) is reached even when Paw is large.
// Hard saturation for runaway numerical cases is enforced by Paw clip
// (1e4 cmH2O in elasticPressure).
function clampVolume(volume, params) {
  const cap = Math.max(params.capacity, 1e-9);
  if (volume > 1000 * cap) return 1000 * cap;
  if (volume < 0) return 0;
  return volume;
}

module.exports = { elasticPressure, clampVolume };
