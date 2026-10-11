#pragma once

#include <optional>
#include <string>

namespace medical_twin::diagnostics {

struct AcidosisDiagnosticResult {
  std::string status;
  double myocardial_pco2_mmhg;
  double lv_volume_ml;
  double dt_s;
  int steps;
  double duration_s;
  double source_equivalent_co2_percent;
  std::optional<double> stress_ratio;
  std::optional<double> peak_fb_mn_per_mm2;
  std::optional<double> lv_pressure_mmhg;
  bool pressure_shadow_eligible;
  bool physiology_authority;
  bool control_authority;
};

AcidosisDiagnosticResult run_acidosis_diagnostic(
    double myocardial_pco2_mmhg,
    double lv_volume_ml,
    double dt_s,
    int steps);

std::string acidosis_diagnostic_json(
    const AcidosisDiagnosticResult& result);

}  // namespace medical_twin::diagnostics
