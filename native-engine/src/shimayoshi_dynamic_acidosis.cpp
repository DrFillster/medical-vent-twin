#include "shimayoshi_dynamic_acidosis.hpp"

#include <cmath>
#include <stdexcept>

namespace medical_twin::myocardium {
namespace {

void require_finite(double value, const char* label) {
  if (!std::isfinite(value)) {
    throw std::invalid_argument(std::string(label) + " must be finite");
  }
}

void require_bounded_co2(double value) {
  require_finite(value, "sourceEquivalentCo2Percent");
  if (value < 5.0 || value > 30.0) {
    throw std::out_of_range(
        "sourceEquivalentCo2Percent is outside validated dynamic source "
        "domain [5,30]");
  }
}

}  // namespace

DynamicAcidosisSurrogate::DynamicAcidosisSurrogate(
    double initial_fast_state,
    double initial_slow_state)
    : fast_state_(initial_fast_state),
      slow_state_(initial_slow_state),
      time_s_(0.0) {
  require_finite(initial_fast_state, "initialFastState");
  require_finite(initial_slow_state, "initialSlowState");
}

AcidosisEquilibrium
DynamicAcidosisSurrogate::equilibrium_for_co2_percent(
    double source_equivalent_co2_percent) {
  require_bounded_co2(source_equivalent_co2_percent);

  const double q = (source_equivalent_co2_percent - 5.0) / 25.0;
  const auto& p = kParameters;

  return AcidosisEquilibrium{
      source_equivalent_co2_percent,
      q,
      p.a1 * q + p.a2 * q * q,
      p.b1 * q + p.b2 * q * q,
      std::exp(p.log_tau_fast_0 + p.log_tau_fast_1 * q),
      std::exp(p.log_tau_slow_0 + p.log_tau_slow_1 * q),
  };
}

AcidosisState DynamicAcidosisSurrogate::step(
    double dt_s,
    double source_equivalent_co2_percent) {
  require_finite(dt_s, "dtSec");
  if (!(dt_s > 0.0)) {
    throw std::invalid_argument("dtSec must be > 0");
  }

  const AcidosisEquilibrium eq =
      equilibrium_for_co2_percent(source_equivalent_co2_percent);

  const double ef = std::exp(-dt_s / eq.tau_fast_s);
  const double es = std::exp(-dt_s / eq.tau_slow_s);

  fast_state_ =
      eq.fast_equilibrium + (fast_state_ - eq.fast_equilibrium) * ef;
  slow_state_ =
      eq.slow_equilibrium + (slow_state_ - eq.slow_equilibrium) * es;
  time_s_ += dt_s;

  return snapshot();
}

AcidosisState DynamicAcidosisSurrogate::snapshot() const {
  const double stress_ratio = 1.0 - fast_state_ + slow_state_;
  return AcidosisState{
      time_s_,
      fast_state_,
      slow_state_,
      stress_ratio,
      kSourceControlPeakFbMnPerMm2 * stress_ratio,
      false,
      false,
  };
}

AcidosisState DynamicAcidosisSurrogate::reset() {
  fast_state_ = 0.0;
  slow_state_ = 0.0;
  time_s_ = 0.0;
  return snapshot();
}

}  // namespace medical_twin::myocardium
