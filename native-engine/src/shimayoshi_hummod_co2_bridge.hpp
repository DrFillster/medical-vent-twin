#pragma once

namespace medical_twin::myocardium {

struct Co2BridgeResult {
  double myocardial_pco2_mmhg;
  double total_pressure_mmhg;
  double source_equivalent_co2_percent;
  bool fitted_gain;
  bool closed_loop_authority;
};

class HumModShimayoshiCo2Bridge {
 public:
  static constexpr double kReferenceTotalPressureMmHg = 790.0;

  static Co2BridgeResult convert(
      double myocardial_pco2_mmhg,
      double total_pressure_mmhg = kReferenceTotalPressureMmHg);
};

}  // namespace medical_twin::myocardium
