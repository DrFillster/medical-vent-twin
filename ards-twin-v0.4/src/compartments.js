// compartments.js — per-compartment elastic recoil law.
//
// Law (finite-capacity exponential, per V0.4.2_MATHEMATICAL_MODEL.md):
//   Vmax   = availability * capacity
//   p_el   = -K * ln(1 - V / Vmax)             for 0 ≤ V < Vmax
//   P_alv  = AOP + p_el
//
// Equivalent forward form (used by init and tests):
//   V(P)   = Vmax * [1 - exp(-(P - AOP) / K)]  for P ≥ AOP
//
// Existing preset convention is preserved:
//   capacity   -> Vcap_i_full   (asymptotic elastic volume when fully available)
//   elasticScale -> K_i        (exponential stiffening pressure scale, cmH2O)
//   derived    -> C_i_full = capacity / elasticScale  (tangent compliance at AOP)
//
// Branch conductance scales with availability:
//   G_i(a) = a / R_i_full    for a > 0, else G_i = 0.
//
// Rules (v0.4.2):
//   - Normal availability = 1.
//   - Recruitable availability = recruitment state r ∈ [0,1].
//   - Consolidated availability = 0 (carries perfusion only, no elastic volume).
//   - elasticPressure rejects V ≥ (1 - epsCap) * Vmax explicitly; no hard clip.
//   - No `MAX_PRESSURE`; the pressure diverges naturally as V → Vmax (as designed).
//   - No `1000 * capacity` clamp; the Newton solver enforces feasibility via line search.

const EPS_CAP = 1e-9;

function availabilityFor(cp, recruitment) {
  if (cp.id === 'normal') return 1.0;
  if (cp.id === 'recruitable') {
    if (typeof recruitment !== 'number' || !Number.isFinite(recruitment)) {
      throw new Error('recruitment must be finite number');
    }
    if (recruitment < 0) return 0;
    if (recruitment > 1) return 1;
    return recruitment;
  }
  if (cp.id === 'consolidated') return 0.0;
  throw new Error(`unknown compartment id ${cp.id}`);
}

function fullCompliance(cp) {
  if (!(cp.elasticScale > 0)) throw new Error('elasticScale must be > 0');
  return cp.capacity / cp.elasticScale;
}

function effectiveVolumeCapacity(cp, recruitment) {
  return availabilityFor(cp, recruitment) * cp.capacity;
}

// Pressure above AOP from elastic volume in [0, Vmax).
// Throws if V is outside the finite-capacity domain.
function elasticPressureAboveAOP(volume, cp, recruitment) {
  const vmax = effectiveVolumeCapacity(cp, recruitment);
  if (vmax <= 0) {
    if (Math.abs(volume) <= 1e-15) return 0;
    throw new Error('positive volume in unavailable compartment');
  }
  if (volume < 0) {
    throw new Error(`negative elastic volume: V=${volume}`);
  }
  if (volume >= (1 - EPS_CAP) * vmax) {
    throw new Error(`volume outside finite-capacity domain: V=${volume}, Vmax=${vmax}`);
  }
  return -cp.elasticScale * Math.log1p(-volume / vmax);
}

// Absolute alveolar pressure = AOP + distending elastic pressure.
function elasticPressure(volume, cp, recruitment, aop = 0) {
  if (typeof aop !== 'number' || !Number.isFinite(aop)) {
    throw new Error('aop must be finite number');
  }
  return aop + elasticPressureAboveAOP(volume, cp, recruitment);
}

// Tangent compliance Ctan = dV/dP. Falls toward zero as V → Vmax.
function tangentCompliance(volume, cp, recruitment) {
  const a = availabilityFor(cp, recruitment);
  if (a <= 0) return 0;
  const vmax = a * cp.capacity;
  if (volume < 0 || volume >= vmax) {
    throw new Error('volume outside finite-capacity domain');
  }
  return a * fullCompliance(cp) * (1 - volume / vmax);
}

// dP/dV = 1 / Ctan (used by Newton Jacobian).
function dPressureDVolume(volume, cp, recruitment) {
  const c = tangentCompliance(volume, cp, recruitment);
  if (!(c > 0)) throw new Error('non-positive tangent compliance');
  return 1 / c;
}

// Inverse: V(P, a, AOP). Used by pressure-consistent initialization.
function forwardElasticVolume(pressure, cp, recruitment, aop = 0) {
  const a = availabilityFor(cp, recruitment);
  if (a <= 0) return 0;
  if (pressure <= aop) return 0;
  const vmax = a * cp.capacity;
  const p = pressure - aop;
  return vmax * (1 - Math.exp(-p / cp.elasticScale));
}

// Branch conductance. Scales linearly with availability.
// At a = 0, conductance is exactly 0 (closed compartment cannot conduct gas).
function branchConductance(cp, recruitment) {
  const a = availabilityFor(cp, recruitment);
  if (a <= 0) return 0;
  if (!(cp.resistance > 0)) throw new Error('resistance must be > 0');
  return a / cp.resistance;
}

// Legacy effective-capacity helper. Now an alias of effectiveVolumeCapacity
// (the old `capacityMultiplier * capacity` semantic is subsumed by availability).
function effectiveCapacity(cp, recruitment) {
  return effectiveVolumeCapacity(cp, recruitment);
}

// Backward-compatible: clampVolume now rejects infeasible volumes rather than
// silently clipping. Used only by legacy code paths and tests.
function clampVolume(volume, cp, recruitment) {
  const vmax = effectiveVolumeCapacity(cp, recruitment);
  if (vmax <= 0) {
    if (Math.abs(volume) <= 1e-15) return 0;
    throw new Error('positive volume in unavailable compartment');
  }
  if (volume < 0) return 0;
  if (volume >= (1 - EPS_CAP) * vmax) {
    throw new Error('volume outside finite-capacity domain');
  }
  return volume;
}

module.exports = {
  EPS_CAP,
  availabilityFor,
  fullCompliance,
  effectiveVolumeCapacity,
  effectiveCapacity,
  elasticPressureAboveAOP,
  elasticPressure,
  tangentCompliance,
  dPressureDVolume,
  forwardElasticVolume,
  branchConductance,
  clampVolume,
};
