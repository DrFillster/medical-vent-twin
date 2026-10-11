#pragma once

namespace medical_twin::myocardium {

struct KatoUtakiParameters {
  double k_r_cm_per_ml;
  double k_v_cm;
  double k_l_um_per_cm;
  double l_b_um;
  double k_s;
  double k_u_mmhg_per_mn_per_mm2;
  double h_lv_cm;
  double k_pe_mn_per_mm2;
  double k_pl_mn_per_mm2;
  double passive_d;
  double l0_um;
};

struct LvPressureResult {
  double lv_volume_ml;
  double radius_cm;
  double half_sarcomere_length_um;
  double cellular_active_stress_mn_per_mm2;
  double active_wall_stress_mn_per_mm2;
  double passive_wall_stress_mn_per_mm2;
  double total_wall_stress_mn_per_mm2;
  double total_pressure_mmhg;
  bool control_authority;
};

class KatoUtakiLvBridge {
 public:
  static constexpr KatoUtakiParameters kParameters{
      0.012,
      1.03,
      0.163,
      0.682,
      7.24,
      7.50064,
      1.35,
      0.2692,
      7.561,
      28.08,
      1.043,
  };

  static double lv_radius_cm_from_volume_ml(double volume_ml);
  static double half_sarcomere_length_um_from_radius_cm(double radius_cm);
  static double scaled_active_wall_stress_mn_per_mm2(
      double cellular_active_stress_mn_per_mm2);
  static double passive_wall_stress_mn_per_mm2(
      double half_sarcomere_length_um);
  static LvPressureResult lv_pressure_from_cellular_stress(
      double lv_volume_ml,
      double cellular_active_stress_mn_per_mm2);
  static double active_lv_pressure_contribution_mmhg(
      double lv_volume_ml,
      double cellular_active_stress_mn_per_mm2);
  static double normalized_active_pressure_ratio(
      double lv_volume_ml,
      double cellular_active_stress_mn_per_mm2,
      double reference_cellular_active_stress_mn_per_mm2);
};

}  // namespace medical_twin::myocardium
