#include "native_diagnostics.hpp"

#include <cassert>
#include <cmath>
#include <iostream>
#include <stdexcept>
#include <string>

using medical_twin::diagnostics::acidosis_diagnostic_json;
using medical_twin::diagnostics::run_acidosis_diagnostic;

int main() {
  const auto baseline =
      run_acidosis_diagnostic(39.5, 120.0, 0.4, 1);
  assert(baseline.source_equivalent_co2_percent == 5.0);
  assert(baseline.stress_ratio.has_value());
  assert(std::abs(*baseline.stress_ratio - 1.0) < 1e-12);
  assert(baseline.lv_pressure_mmhg.has_value());
  assert(!baseline.physiology_authority);
  assert(!baseline.control_authority);

  const auto high =
      run_acidosis_diagnostic(158.0, 120.0, 0.4, 300);
  assert(high.source_equivalent_co2_percent == 20.0);
  assert(high.duration_s == 120.0);
  assert(high.stress_ratio.has_value());
  assert(*high.stress_ratio < 1.0);
  assert(high.lv_pressure_mmhg.has_value());
  assert(*high.lv_pressure_mmhg < *baseline.lv_pressure_mmhg);

  const auto blocked =
      run_acidosis_diagnostic(250.0, 120.0, 0.4, 10);
  assert(!blocked.pressure_shadow_eligible);
  assert(!blocked.stress_ratio.has_value());
  assert(!blocked.lv_pressure_mmhg.has_value());

  const std::string json = acidosis_diagnostic_json(high);
  assert(json.find("\"schema\":\"native-acidosis-diagnostic/v1\"") !=
         std::string::npos);
  assert(json.find("\"physiologyAuthority\":false") != std::string::npos);
  assert(json.find("\"controlAuthority\":false") != std::string::npos);
  assert(json.find("\"stateless\":true") != std::string::npos);

  bool rejected = false;
  try {
    run_acidosis_diagnostic(158.0, 120.0, 0.4, 0);
  } catch (const std::invalid_argument&) {
    rejected = true;
  }
  assert(rejected);

  std::cout
      << "ok - native acidosis diagnostic is stateless, source-bounded, "
         "and non-authoritative\n";
  return 0;
}
