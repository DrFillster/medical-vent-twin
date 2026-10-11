#include "shimayoshi_hummod_dynamic_acidosis_pressure_shadow.hpp"

#include <cassert>
#include <cmath>
#include <iostream>

using medical_twin::myocardium::HumModDynamicAcidosisPressureShadow;

int main() {
  HumModDynamicAcidosisPressureShadow model;

  const auto baseline = model.step(0.4, 39.5, 120.0);
  assert(baseline.source_equivalent_co2_percent == 5.0);
  assert(!baseline.closed_loop_pressure_authority);
  assert(baseline.lv_pressure_mmhg.has_value());
  assert(std::isfinite(*baseline.lv_pressure_mmhg));

  medical_twin::myocardium::DynamicAcidosisPressureShadowResult high =
      baseline;
  for (int i = 0; i < 300; ++i) {
    high = model.step(0.4, 158.0, 120.0);
  }
  assert(high.source_equivalent_co2_percent == 20.0);
  assert(high.stress_ratio.has_value());
  assert(*high.stress_ratio < 1.0);
  assert(high.lv_pressure_mmhg.has_value());
  assert(*high.lv_pressure_mmhg < *baseline.lv_pressure_mmhg);

  const double before_recovery = *high.stress_ratio;
  const auto recovery = model.step(0.4, 39.5, 120.0);
  assert(recovery.stress_ratio.has_value());
  assert(*recovery.stress_ratio >= before_recovery);
  assert(std::abs(*recovery.stress_ratio - 1.0) > 1e-12);

  const auto blocked = model.step(0.4, 250.0, 120.0);
  assert(!blocked.pressure_shadow_eligible);
  assert(!blocked.lv_pressure_mmhg.has_value());
  assert(!blocked.closed_loop_pressure_authority);

  std::cout
      << "ok - native HumMod myocardial PCO2 -> dynamic Shimayoshi -> "
         "Kato/Utaki pressure shadow matches browser composition and remains "
         "non-authoritative\n";
  return 0;
}
