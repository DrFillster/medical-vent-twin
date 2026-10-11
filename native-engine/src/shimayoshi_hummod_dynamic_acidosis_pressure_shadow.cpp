#include "shimayoshi_hummod_dynamic_acidosis_pressure_shadow.hpp"

namespace medical_twin::myocardium {

DynamicAcidosisPressureShadowResult
HumModDynamicAcidosisPressureShadow::step(
    double dt_s,
    double myocardial_pco2_mmhg,
    double lv_volume_ml) {
  const Co2BridgeResult bridge =
      HumModShimayoshiCo2Bridge::convert(myocardial_pco2_mmhg);

  const double u = bridge.source_equivalent_co2_percent;
  if (u < 5.0 || u > 30.0) {
    return DynamicAcidosisPressureShadowResult{
        "outside-validated-Shimayoshi-dynamic-acidosis-domain",
        myocardial_pco2_mmhg,
        u,
        std::nullopt,
        std::nullopt,
        std::nullopt,
        std::nullopt,
        std::nullopt,
        false,
        false,
        false,
    };
  }

  const AcidosisState source_state = surrogate_.step(dt_s, u);
  const LvPressureResult pressure =
      KatoUtakiLvBridge::lv_pressure_from_cellular_stress(
          lv_volume_ml,
          source_state.peak_fb_mn_per_mm2);

  return DynamicAcidosisPressureShadowResult{
      "HumMod-myocardial-PCO2-to-dynamic-Shimayoshi-LV-pressure-shadow-complete",
      myocardial_pco2_mmhg,
      u,
      source_state,
      pressure,
      pressure.total_pressure_mmhg,
      source_state.peak_fb_mn_per_mm2,
      source_state.stress_ratio,
      true,
      false,
      false,
  };
}

AcidosisState HumModDynamicAcidosisPressureShadow::snapshot() const {
  return surrogate_.snapshot();
}

AcidosisState HumModDynamicAcidosisPressureShadow::reset() {
  return surrogate_.reset();
}

}  // namespace medical_twin::myocardium
