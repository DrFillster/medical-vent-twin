#include "shimayoshi_dynamic_acidosis.hpp"

#include <cassert>
#include <cmath>
#include <iostream>
#include <stdexcept>

using medical_twin::myocardium::DynamicAcidosisSurrogate;

namespace {

bool near(double a, double b, double tolerance) {
  return std::abs(a - b) <= tolerance;
}

}  // namespace

int main() {
  const auto baseline =
      DynamicAcidosisSurrogate::equilibrium_for_co2_percent(5.0);
  assert(near(baseline.fast_equilibrium, 0.0, 1e-15));
  assert(near(baseline.slow_equilibrium, 0.0, 1e-15));
  assert(baseline.tau_fast_s > 0.0);
  assert(baseline.tau_slow_s > baseline.tau_fast_s);

  DynamicAcidosisSurrogate model;
  auto state = model.step(0.4, 30.0);
  assert(state.stress_ratio < 1.0);
  assert(!state.closed_loop_pressure_authority);
  assert(!state.control_authority);

  for (int i = 0; i < 299; ++i) {
    state = model.step(0.4, 30.0);
  }
  assert(state.stress_ratio < 0.95);

  const double before_recovery = state.stress_ratio;
  const auto recovery = model.step(0.4, 5.0);
  assert(recovery.stress_ratio >= before_recovery);
  assert(!near(recovery.stress_ratio, 1.0, 1e-12));

  bool rejected = false;
  try {
    model.step(0.4, 31.0);
  } catch (const std::out_of_range&) {
    rejected = true;
  }
  assert(rejected);

  // Cross-language parity checkpoints generated from the current JS model.
  DynamicAcidosisSurrogate parity;
  for (int i = 0; i < 300; ++i) {
    parity.step(0.4, 20.0);
  }
  const auto p120 = parity.snapshot();

  // These values are intentionally strict enough to catch coefficient or
  // equation drift, while allowing normal libm/compiler rounding.
  assert(near(p120.time_s, 120.0, 1e-10));
  assert(near(p120.stress_ratio, 0.936407837733084, 1e-12));
  assert(near(p120.peak_fb_mn_per_mm2, 5.656884043184225, 1e-12));

  std::cout
      << "ok - native Shimayoshi dynamic acidosis surrogate preserves "
         "validated browser equations and remains shadow-only\n";
  return 0;
}
