#pragma once

#include <string>

namespace medical_twin::myocardium {

struct AcidosisParameters {
  double a1;
  double a2;
  double b1;
  double b2;
  double log_tau_fast_0;
  double log_tau_fast_1;
  double log_tau_slow_0;
  double log_tau_slow_1;
};

struct AcidosisEquilibrium {
  double source_equivalent_co2_percent;
  double q;
  double fast_equilibrium;
  double slow_equilibrium;
  double tau_fast_s;
  double tau_slow_s;
};

struct AcidosisState {
  double time_s;
  double fast_depressive_state;
  double slow_adaptive_state;
  double stress_ratio;
  double peak_fb_mn_per_mm2;
  bool closed_loop_pressure_authority;
  bool control_authority;
};

class DynamicAcidosisSurrogate {
 public:
  static constexpr double kSourceControlPeakFbMnPerMm2 =
      6.041059088461671;

  static constexpr AcidosisParameters kParameters{
      0.22337553,
      -0.01909800,
      0.11366576,
      0.03267191,
      4.29156786,
      -0.37587466,
      5.90545769,
      -0.46063629,
  };

  DynamicAcidosisSurrogate(double initial_fast_state = 0.0,
                           double initial_slow_state = 0.0);

  static AcidosisEquilibrium equilibrium_for_co2_percent(
      double source_equivalent_co2_percent);

  AcidosisState step(double dt_s, double source_equivalent_co2_percent);
  AcidosisState snapshot() const;
  AcidosisState reset();

 private:
  double fast_state_;
  double slow_state_;
  double time_s_;
};

}  // namespace medical_twin::myocardium
