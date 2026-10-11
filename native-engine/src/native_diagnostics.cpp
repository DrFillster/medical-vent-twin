#include "native_diagnostics.hpp"

#include "shimayoshi_hummod_dynamic_acidosis_pressure_shadow.hpp"

#include <cmath>
#include <iomanip>
#include <sstream>
#include <stdexcept>

namespace medical_twin::diagnostics {
namespace {

void require_finite(double value, const char* label) {
  if (!std::isfinite(value)) {
    throw std::invalid_argument(std::string(label) + " must be finite");
  }
}

void require_positive(double value, const char* label) {
  require_finite(value, label);
  if (!(value > 0.0)) {
    throw std::invalid_argument(std::string(label) + " must be > 0");
  }
}

void append_optional_number(
    std::ostringstream& out,
    const char* key,
    const std::optional<double>& value,
    bool trailing_comma = true) {
  out << "\"" << key << "\":";
  if (value.has_value()) {
    out << std::setprecision(17) << *value;
  } else {
    out << "null";
  }
  if (trailing_comma) out << ",";
}

}  // namespace

AcidosisDiagnosticResult run_acidosis_diagnostic(
    double myocardial_pco2_mmhg,
    double lv_volume_ml,
    double dt_s,
    int steps) {
  require_finite(myocardial_pco2_mmhg, "myocardialPco2MmHg");
  if (myocardial_pco2_mmhg < 0.0) {
    throw std::invalid_argument("myocardialPco2MmHg must be >= 0");
  }
  require_positive(lv_volume_ml, "lvVolumeMl");
  require_positive(dt_s, "dtSec");
  if (steps < 1 || steps > 1000000) {
    throw std::invalid_argument("steps must be between 1 and 1000000");
  }

  medical_twin::myocardium::HumModDynamicAcidosisPressureShadow model;
  medical_twin::myocardium::DynamicAcidosisPressureShadowResult state =
      model.step(dt_s, myocardial_pco2_mmhg, lv_volume_ml);

  for (int i = 1; i < steps; ++i) {
    state = model.step(dt_s, myocardial_pco2_mmhg, lv_volume_ml);
  }

  return AcidosisDiagnosticResult{
      state.status,
      myocardial_pco2_mmhg,
      lv_volume_ml,
      dt_s,
      steps,
      dt_s * static_cast<double>(steps),
      state.source_equivalent_co2_percent,
      state.stress_ratio,
      state.source_cellular_active_stress_mn_per_mm2,
      state.lv_pressure_mmhg,
      state.pressure_shadow_eligible,
      false,
      false,
  };
}

std::string acidosis_diagnostic_json(
    const AcidosisDiagnosticResult& result) {
  std::ostringstream out;
  out << std::setprecision(17);
  out << "{"
      << "\"schema\":\"native-acidosis-diagnostic/v1\","
      << "\"status\":\"" << result.status << "\","
      << "\"myocardialPco2MmHg\":" << result.myocardial_pco2_mmhg << ","
      << "\"lvVolumeMl\":" << result.lv_volume_ml << ","
      << "\"dtSec\":" << result.dt_s << ","
      << "\"steps\":" << result.steps << ","
      << "\"durationSec\":" << result.duration_s << ","
      << "\"sourceEquivalentCo2Percent\":"
      << result.source_equivalent_co2_percent << ",";
  append_optional_number(out, "stressRatio", result.stress_ratio);
  append_optional_number(out, "peakFbMnPerMm2", result.peak_fb_mn_per_mm2);
  append_optional_number(out, "lvPressureMmHg", result.lv_pressure_mmhg);
  out << "\"pressureShadowEligible\":"
      << (result.pressure_shadow_eligible ? "true" : "false") << ","
      << "\"physiologyAuthority\":false,"
      << "\"controlAuthority\":false,"
      << "\"stateless\":true"
      << "}";
  return out.str();
}

}  // namespace medical_twin::diagnostics
