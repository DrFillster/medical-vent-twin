#include "kato_utaki_lv_bridge.hpp"
#include "shimayoshi_hummod_co2_bridge.hpp"

#include <cassert>
#include <cmath>
#include <iostream>
#include <stdexcept>

using medical_twin::myocardium::HumModShimayoshiCo2Bridge;
using medical_twin::myocardium::KatoUtakiLvBridge;

namespace {

bool near(double a, double b, double tolerance) {
  return std::abs(a - b) <= tolerance;
}

}  // namespace

int main() {
  const auto baseline = HumModShimayoshiCo2Bridge::convert(39.5);
  assert(near(baseline.source_equivalent_co2_percent, 5.0, 1e-15));
  assert(!baseline.fitted_gain);
  assert(!baseline.closed_loop_authority);

  const auto high = HumModShimayoshiCo2Bridge::convert(79.0);
  assert(near(high.source_equivalent_co2_percent, 10.0, 1e-15));

  bool co2_rejected = false;
  try {
    HumModShimayoshiCo2Bridge::convert(-1.0);
  } catch (const std::invalid_argument&) {
    co2_rejected = true;
  }
  assert(co2_rejected);

  const auto& p = KatoUtakiLvBridge::kParameters;
  assert(near(p.k_r_cm_per_ml, 0.012, 1e-15));
  assert(near(p.k_v_cm, 1.03, 1e-15));
  assert(near(p.k_l_um_per_cm, 0.163, 1e-15));
  assert(near(p.l_b_um, 0.682, 1e-15));
  assert(near(p.k_s, 7.24, 1e-15));
  assert(near(p.k_u_mmhg_per_mn_per_mm2, 7.50064, 1e-15));
  assert(near(p.h_lv_cm, 1.35, 1e-15));
  assert(near(p.k_pe_mn_per_mm2, 0.2692, 1e-15));
  assert(near(p.k_pl_mn_per_mm2, 7.561, 1e-15));
  assert(near(p.passive_d, 28.08, 1e-15));
  assert(near(p.l0_um, 1.043, 1e-15));

  const double radius =
      KatoUtakiLvBridge::lv_radius_cm_from_volume_ml(126.419);
  assert(std::isfinite(radius) && radius > 0.0);

  const double half_length =
      KatoUtakiLvBridge::half_sarcomere_length_um_from_radius_cm(radius);
  assert(std::isfinite(half_length) && half_length > 0.0);

  assert(std::abs(
      KatoUtakiLvBridge::passive_wall_stress_mn_per_mm2(p.l0_um)) < 1e-12);
  assert(
      KatoUtakiLvBridge::passive_wall_stress_mn_per_mm2(p.l0_um * 0.99) < 0.0);
  assert(
      KatoUtakiLvBridge::passive_wall_stress_mn_per_mm2(p.l0_um * 1.01) > 0.0);

  const double ratio =
      KatoUtakiLvBridge::normalized_active_pressure_ratio(
          126.419, 0.5, 1.0);
  assert(std::abs(ratio - 0.5) < 1e-12);

  const auto total =
      KatoUtakiLvBridge::lv_pressure_from_cellular_stress(126.419, 1.0);
  assert(std::isfinite(total.total_pressure_mmhg));
  assert(std::isfinite(total.passive_wall_stress_mn_per_mm2));
  assert(!total.control_authority);

  std::cout
      << "ok - native HumMod/CO2 and Kato/Utaki bridges preserve accepted "
         "browser source equations and remain shadow-only\n";
  return 0;
}
