#include "shimayoshi_hummod_co2_bridge.hpp"

#include <cmath>
#include <stdexcept>

namespace medical_twin::myocardium {

Co2BridgeResult HumModShimayoshiCo2Bridge::convert(
    double myocardial_pco2_mmhg,
    double total_pressure_mmhg) {
  if (!std::isfinite(myocardial_pco2_mmhg) || myocardial_pco2_mmhg < 0.0) {
    throw std::invalid_argument("myocardialPco2MmHg must be finite and >= 0");
  }
  if (!std::isfinite(total_pressure_mmhg) || !(total_pressure_mmhg > 0.0)) {
    throw std::invalid_argument("totalPressureMmHg must be finite and > 0");
  }

  return Co2BridgeResult{
      myocardial_pco2_mmhg,
      total_pressure_mmhg,
      100.0 * myocardial_pco2_mmhg / total_pressure_mmhg,
      false,
      false,
  };
}

}  // namespace medical_twin::myocardium
