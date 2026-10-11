#include "kato_utaki_lv_bridge.hpp"

#include <cmath>
#include <stdexcept>

namespace medical_twin::myocardium {
namespace {

void require_positive(double value, const char* label) {
  if (!std::isfinite(value) || !(value > 0.0)) {
    throw std::invalid_argument(std::string(label) + " must be finite and > 0");
  }
}

void require_nonnegative(double value, const char* label) {
  if (!std::isfinite(value) || value < 0.0) {
    throw std::invalid_argument(std::string(label) + " must be finite and >= 0");
  }
}

}  // namespace

double KatoUtakiLvBridge::lv_radius_cm_from_volume_ml(double volume_ml) {
  require_positive(volume_ml, "volumeMl");
  return kParameters.k_r_cm_per_ml * volume_ml + kParameters.k_v_cm;
}

double KatoUtakiLvBridge::half_sarcomere_length_um_from_radius_cm(
    double radius_cm) {
  require_positive(radius_cm, "radiusCm");
  return kParameters.k_l_um_per_cm * radius_cm + kParameters.l_b_um;
}

double KatoUtakiLvBridge::scaled_active_wall_stress_mn_per_mm2(
    double cellular_active_stress_mn_per_mm2) {
  require_nonnegative(
      cellular_active_stress_mn_per_mm2,
      "cellularActiveStressMnPerMm2");
  return kParameters.k_s * cellular_active_stress_mn_per_mm2;
}

double KatoUtakiLvBridge::passive_wall_stress_mn_per_mm2(
    double half_sarcomere_length_um) {
  require_positive(half_sarcomere_length_um, "halfSarcomereLengthUm");

  const double length = half_sarcomere_length_um;
  const double l0 = kParameters.l0_um;
  if (length < l0) {
    return -kParameters.k_pl_mn_per_mm2 * (1.0 - length / l0);
  }
  return kParameters.k_pe_mn_per_mm2 *
      (std::exp(kParameters.passive_d * (length / l0 - 1.0)) - 1.0);
}

LvPressureResult KatoUtakiLvBridge::lv_pressure_from_cellular_stress(
    double lv_volume_ml,
    double cellular_active_stress_mn_per_mm2) {
  const double radius_cm = lv_radius_cm_from_volume_ml(lv_volume_ml);
  const double half_sarcomere_length_um =
      half_sarcomere_length_um_from_radius_cm(radius_cm);
  const double active_wall_stress =
      scaled_active_wall_stress_mn_per_mm2(
          cellular_active_stress_mn_per_mm2);
  const double passive_wall_stress =
      passive_wall_stress_mn_per_mm2(half_sarcomere_length_um);
  const double total_wall_stress =
      active_wall_stress + passive_wall_stress;
  const double total_pressure =
      2.0 *
      kParameters.k_u_mmhg_per_mn_per_mm2 *
      total_wall_stress *
      kParameters.h_lv_cm /
      radius_cm;

  return LvPressureResult{
      lv_volume_ml,
      radius_cm,
      half_sarcomere_length_um,
      cellular_active_stress_mn_per_mm2,
      active_wall_stress,
      passive_wall_stress,
      total_wall_stress,
      total_pressure,
      false,
  };
}

double KatoUtakiLvBridge::active_lv_pressure_contribution_mmhg(
    double lv_volume_ml,
    double cellular_active_stress_mn_per_mm2) {
  const double radius_cm = lv_radius_cm_from_volume_ml(lv_volume_ml);
  const double active_wall_stress =
      scaled_active_wall_stress_mn_per_mm2(
          cellular_active_stress_mn_per_mm2);

  return 2.0 *
      kParameters.k_u_mmhg_per_mn_per_mm2 *
      active_wall_stress *
      kParameters.h_lv_cm /
      radius_cm;
}

double KatoUtakiLvBridge::normalized_active_pressure_ratio(
    double lv_volume_ml,
    double cellular_active_stress_mn_per_mm2,
    double reference_cellular_active_stress_mn_per_mm2) {
  const double current = active_lv_pressure_contribution_mmhg(
      lv_volume_ml,
      cellular_active_stress_mn_per_mm2);
  const double reference = active_lv_pressure_contribution_mmhg(
      lv_volume_ml,
      reference_cellular_active_stress_mn_per_mm2);
  if (reference == 0.0) {
    throw std::invalid_argument(
        "referenceCellularActiveStressMnPerMm2 must produce nonzero pressure");
  }
  return current / reference;
}

}  // namespace medical_twin::myocardium
