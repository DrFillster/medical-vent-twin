// recruitment.js — stateful dynamic recruitment/derecruitment with hysteresis.
//
// v0.4.2 kinetics (bounded opening/closing, finite-capacity-feasible):
//
// Driver:  pdist = max(P_alv - AOP, 0)        pressure above AOP, clamped to ≥0
//
// Opening:  dr/dt =  k_open * (pdist - P_open) * (1 - r)   if pdist >  P_open
// Closing:  dr/dt = -k_close * (P_close - pdist) * r       if pdist <  P_close
// Dead-band: dr/dt = 0                                      otherwise
//
// Required:  P_close < P_open.
//
// The factors (1-r) and r make [0,1] invariant for ordinary steps without
// hard clipping.
//
// Derecruitment feasibility:
//   A decrease in availability decreases Vmax. The model must never
//   silently destroy elastic gas volume by clipping V to the new capacity.
//   For a recruitable compartment, the minimum feasible r is:
//     r_min = V / ((1 - epsCap) * capacity)
//   A closing update is clamped to r_min (so closing pauses until enough
//   gas has actually left through modeled flow).
//
// fN_max (the v0.4 multiplicative capacity scaling) is deprecated; the
// new model uses linear availability scaling instead.

const EPS_CAP = 1e-9;

const OPEN_DEFAULT = 25;       // cmH2O above AOP
const CLOSE_DEFAULT = 10;      // cmH2O above AOP
const K_OPEN_DEFAULT = 0.02;   // 1/(cmH2O·s)
const K_CLOSE_DEFAULT = 0.05;  // 1/(cmH2O·s)

function distendingPressure(pAlv, aop) {
  return Math.max(0, pAlv - aop);
}

// Bounded opening/closing rate. Returns dr/dt in 1/s.
// Caller must enforce P_close < P_open; we throw here if not.
function recruitmentRate(recruitment, pDist, params = {}) {
  const Popen = params.P_open ?? OPEN_DEFAULT;
  const Pclose = params.P_close ?? CLOSE_DEFAULT;
  const kopen = params.k_open ?? K_OPEN_DEFAULT;
  const kclose = params.k_close ?? K_CLOSE_DEFAULT;
  if (!(Pclose < Popen)) {
    throw new Error(`P_close (${Pclose}) must be < P_open (${Popen})`);
  }
  const r = clamp(recruitment, 0, 1);
  if (pDist > Popen) return kopen * (pDist - Popen) * (1 - r);
  if (pDist < Pclose) return -kclose * (Pclose - pDist) * r;
  return 0;
}

// Forward-Euler step. Returns the new r in [0,1].
function stepRecruitment(recruitment, PAlv, dt, params = {}, aop = 0) {
  const pdist = distendingPressure(PAlv, aop);
  const rate = recruitmentRate(recruitment, pdist, params);
  return clamp(recruitment + rate * dt, 0, 1);
}

// Minimum feasible recruitment given an existing elastic volume.
// A closing update may not move below this floor.
// For non-recruitable compartments this returns the constant availability.
function minimumFeasibleRecruitment(volume, cp, epsCap = EPS_CAP) {
  if (cp.id !== 'recruitable') {
    // Normal: availability is 1; consolidated: 0.
    if (cp.id === 'normal') return 1;
    if (cp.id === 'consolidated') return 0;
    throw new Error(`unknown compartment id ${cp.id}`);
  }
  if (cp.capacity <= 0) return 0;
  return clamp(volume / ((1 - epsCap) * cp.capacity), 0, 1);
}

// Step with feasibility floor. r_candidate is the rate-based update; if
// it tries to close below the feasible floor (because gas is still in
// the compartment), it stalls at the floor.
function stepRecruitmentWithFloor(recruitment, PAlv, dt, volume, cp, aop = 0) {
  const rCandidate = stepRecruitment(recruitment, PAlv, dt, cp, aop);
  const rFloor = minimumFeasibleRecruitment(volume, cp);
  return Math.max(rCandidate, rFloor);
}

function clamp(x, lo, hi) {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

module.exports = {
  EPS_CAP,
  OPEN_DEFAULT,
  CLOSE_DEFAULT,
  K_OPEN_DEFAULT,
  K_CLOSE_DEFAULT,
  distendingPressure,
  recruitmentRate,
  stepRecruitment,
  minimumFeasibleRecruitment,
  stepRecruitmentWithFloor,
  clamp,
  // Deprecated (v0.4): kept as a no-op shim for legacy callers. The new law
  // uses availability-based capacity scaling, not the old capMult * capacity.
  capacityMultiplier(recruitment, _fN_max) {
    if (typeof recruitment !== 'number') return 1;
    if (recruitment < 0) return 1;
    if (recruitment > 1) return 1;
    return 1;  // No scaling; the new law scales via availability instead.
  },
};
