// recruitment.js — stateful dynamic recruitment/derecruitment with hysteresis.
//
// Each recruitable compartment tracks a recruitment state in [0, 1].
// Two thresholds (cmH2O):
//   P_open  — pressure above which opening accelerates
//   P_close — pressure below which closing accelerates (P_close < P_open)
//
// Opening/closing dynamics (deterministic, no stochastic noise):
//   rate = (P_alv - P_open) * k_open   if P_alv > P_open  (open)
//   rate = (P_close - P_alv) * k_close if P_alv < P_close (close)
//   rate = 0                             otherwise (hysteresis dead-band)
//
// dt integration via forward Euler, clipped to [0, 1].
// Recruitment affects capacity multiplicatively: effective_capacity =
// capacity * (1 + (fN_max - 1) * recruitment) where fN_max is a per-
// compartment scaling cap. This matches the rc1 reference convention.
//
// Recruitment state evolves independently per compartment; no cross-
// compartment coupling. The model is intentionally inspectable — every
// parameter has a name.

const OPEN_DEFAULT = 25;       // cmH2O
const CLOSE_DEFAULT = 10;      // cmH2O
const K_OPEN_DEFAULT = 0.02;   // 1/(cmH2O·s)
const K_CLOSE_DEFAULT = 0.05;  // 1/(cmH2O·s)

function stepRecruitment(recruitment, PAlv, dt, params = {}) {
  const Popen = params.P_open ?? OPEN_DEFAULT;
  const Pclose = params.P_close ?? CLOSE_DEFAULT;
  const kopen = params.k_open ?? K_OPEN_DEFAULT;
  const kclose = params.k_close ?? K_CLOSE_DEFAULT;

  let r = recruitment;
  if (PAlv > Popen) {
    // Above opening threshold: open (recruitment increases).
    r = r + (PAlv - Popen) * kopen * dt;
  } else if (PAlv < Pclose) {
    // Below closing threshold: close (recruitment decreases).
    r = r - (Pclose - PAlv) * kclose * dt;
  }
  if (r < 0) r = 0;
  if (r > 1) r = 1;
  return r;
}

// Compute the effective capacity multiplier for a recruitable compartment.
// recruitment=0 → multiplier 1 (collapsed/atelectatic tissue contributes
// nothing extra). recruitment=1 → multiplier = fN_max.
function capacityMultiplier(recruitment, fN_max = 2.0) {
  return 1 + (fN_max - 1) * recruitment;
}

module.exports = {
  stepRecruitment,
  capacityMultiplier,
  OPEN_DEFAULT,
  CLOSE_DEFAULT,
  K_OPEN_DEFAULT,
  K_CLOSE_DEFAULT,
};
