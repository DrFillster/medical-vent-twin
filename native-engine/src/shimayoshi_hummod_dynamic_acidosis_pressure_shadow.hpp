#pragma once

#include "kato_utaki_lv_bridge.hpp"
#include "shimayoshi_dynamic_acidosis.hpp"
#include "shimayoshi_hummod_co2_bridge.hpp"

#include <optional>

namespace medical_twin::myocardium {

struct DynamicAcidosisPressureShadowResult {
  const char* status;
  double myocardial_pco2_mmhg;
  double source_equivalent_co2_percent;
  std::optional<AcidosisState> source_state;
  std::optional<LvPressureResult> pressure_shadow;
  std::optional<double> lv_pressure_mmhg;
  std::optional<double> source_cellular_active_stress_mn_per_mm2;
  std::optional<double> stress_ratio;
  bool pressure_shadow_eligible;
  bool closed_loop_pressure_authority;
  bool control_authority;
};

class HumModDynamicAcidosisPressureShadow {
 public:
  HumModDynamicAcidosisPressureShadow() = default;

  DynamicAcidosisPressureShadowResult step(
      double dt_s,
      double myocardial_pco2_mmhg,
      double lv_volume_ml);

  AcidosisState snapshot() const;
  AcidosisState reset();

 private:
  DynamicAcidosisSurrogate surrogate_;
};

}  // namespace medical_twin::myocardium
