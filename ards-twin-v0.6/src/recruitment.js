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
// v0.4.3 derecruitment feasibility (projection rule):
//
//   A decrease in availability decreases Vmax. The model must never
//   silently destroy elastic gas volume by clipping V to the new capacity.
//   For a recruitable compartment, the minimum feasible r is:
//
//     r_min = V / ((1 - epsCap) * capacity)
//
//   v0.4.3 implements a projection rule:
//
//     1. Compute proposed derecruitment r_new = stepRecruitment(...).
//     2. Compute r_min = minimumFeasibleRecruitment(V, capacity).
//     3. If r_new < r_min, project r_new onto the feasible set:
//        - If V exceeds (1 - EPS_PROJ) * Vmax(r_new) at the proposed r,
//          limit r_new to the largest feasible r with margin
//          V <= (1 - EPS_PROJ) * Vmax(r_feasible).
//        - Otherwise, accept r_new.
//     4. The remaining "trapped gas" can only leave via modeled flow.
//        This rule preserves the invariant: V <= Vmax(r) at all times.
//
//   Projection margin: EPS_PROJ = 1e-6, applied at the
//   feasibility boundary so subsequent small pressure changes do not
//   immediately re-trigger the projection.
//
// fN_max (the v0.4 multiplicative capacity scaling) is deprecated; the
// new model uses linear availability scaling instead.

const EPS_CAP = 1e-9;
const EPS_PROJ = 1e-6;          // v0.4.3: projection margin

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

// v0.4.3: step with feasibility projection.
// r_candidate is the rate-based update; if it tries to close below
// the feasible floor, project it onto the feasible set with margin.
function stepRecruitmentWithFloor(recruitment, PAlv, dt, volume, cp, aop = 0) {
  const rCandidate = stepRecruitment(recruitment, PAlv, dt, cp, aop);
  const rFloor = minimumFeasibleRecruitment(volume, cp);
  if (rCandidate >= rFloor) return rCandidate;
  // Projection: find the largest r <= rFloor with V <= (1 - EPS_PROJ) * Vmax(r).
  // For a linear Vmax(r) = r * capacity, the constraint is:
  //   V <= (1 - EPS_PROJ) * r * capacity
  //   r >= V / ((1 - EPS_PROJ) * capacity)
  if (cp.id !== 'recruitable' || cp.capacity <= 0) {
    return rFloor;  // non-recruitable: structural.
  }
  const projectedR = volume / ((1 - EPS_PROJ) * cp.capacity);
  // The clamped value must not exceed rFloor (the closed-loop floor).
  // We return max(rCandidate, projectedR) which is the smallest of:
  //   - rCandidate (the requested update)
  //   - projectedR (the feasibility boundary)
  //   and we cap at 1 via the rFloor + stepRecruitment floor at r=1.
  return Math.max(rCandidate, Math.min(projectedR, 1));
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
