"""Independent identities, limits, and regression guards for the reference.
Run: python -m unittest -v test_lung_reference
These are software/model checks, not physiological validation.
"""

from dataclasses import replace
import math
import unittest
import lung_reference as m


class ReferenceChecks(unittest.TestCase):
    def setUp(self):
        self.lung = m.Lung()
        self.vent = m.Vent()
        self.gas = m.Gas()
        self.state = m.state_after(self.lung, (30, 10))

    def test_invalid_inputs(self):
        for kwargs in ({"tissue": (0.2, 0.2, 0.2)},
                       {"resistance": -1}, {"aop": float("nan")},
                       {"opening_mid": 1}, {"units": 2},
                       {"tissue": (1, 0, 0)}):
            with self.assertRaises(ValueError):
                m.Lung(**kwargs)
        with self.assertRaises(ValueError):
            m.Vent(fio2=1.1)
        with self.assertRaises(ValueError):
            m.Vent(rr=100, flow=0.1)
        with self.assertRaises(ValueError):
            m.Gas(dead_fraction=1)

    def test_pbw_protocol_coefficients(self):
        self.assertAlmostEqual(m.pbw_kg(152.4, "male"), 50)
        self.assertAlmostEqual(m.pbw_kg(152.4, "female"), 45.5)
        self.assertAlmostEqual(m.pbw_kg(175, "male"), 70.566)

    def test_volume_derivative_matches_compliance(self):
        for pressure in (5, 10, 20, 40):
            h = 1e-4
            d = (m.volume(self.lung, self.state, pressure + h)
                 - m.volume(self.lung, self.state, pressure - h)) / (2 * h)
            c = m.tangent_compliance(self.lung, self.state, pressure)
            self.assertAlmostEqual(d, c, places=9)

    def test_integrated_compliance_matches_volume(self):
        # Independent midpoint integration of the exported derivative.
        lo, hi, n = 5, 30, 4000
        dp = (hi - lo) / n
        area = sum(m.tangent_compliance(self.lung, self.state,
                   lo + (i + 0.5) * dp) * dp for i in range(n))
        delta = (m.volume(self.lung, self.state, hi)
                 - m.volume(self.lung, self.state, lo))
        self.assertAlmostEqual(area, delta, places=7)

    def test_inverse_and_capacity_guard(self):
        for pressure in (4, 10, 20, 60):
            v = m.volume(self.lung, self.state, pressure)
            p = m.pressure_for_volume(self.lung, self.state, v)
            self.assertAlmostEqual(p, pressure, places=8)
        with self.assertRaises(ValueError):
            m.pressure_for_volume(self.lung, self.state, 100)

    def test_history_and_reset(self):
        up = m.state_after(self.lung, (14,))
        down = m.state_after(self.lung, (30, 14))
        self.assertGreater(sum(down), sum(up))
        self.assertEqual(m.step_peep(self.lung, down, 0),
                         m.empty_state(self.lung))

    def test_stiffening_at_fixed_recruitment(self):
        low = m.tangent_compliance(self.lung, self.state, 10)
        high = m.tangent_compliance(self.lung, self.state, 30)
        self.assertGreater(low, high)

    def test_shunt_bounds_and_recruitment_effect(self):
        closed = m.empty_state(self.lung)
        opened = (True,) * self.lung.units
        s0 = m.effective_shunt(self.lung, closed)
        s1 = m.effective_shunt(self.lung, opened)
        self.assertTrue(0 <= s1 <= s0 <= 1)
        self.assertGreaterEqual(s1, self.lung.perfusion[2])

    def test_exact_p50_and_monotone_saturation(self):
        self.assertAlmostEqual(m.saturation(26.8), 0.5, places=12)
        values = [m.saturation(x) for x in (0, 20, 40, 80, 200, 700)]
        self.assertEqual(values, sorted(values))
        self.assertTrue(all(0 <= x <= 1 for x in values))

    def test_oxygen_content_balance(self):
        g = m.gas_exchange(self.lung, self.vent, self.state, self.gas)
        s = g["effective_shunt"]
        self.assertAlmostEqual(g["ca_o2"], (1 - s) * g["cc_o2"]
                               + s * g["cv_o2"], places=12)
        self.assertAlmostEqual(m.oxygen_content(g["pao2"], self.gas),
                               g["ca_o2"], places=10)

    def test_zero_and_total_shunt_limits(self):
        clear = replace(self.lung, perfusion=(1, 0, 0), residual_normal=0)
        g0 = m.gas_exchange(clear, self.vent, self.state, self.gas)
        self.assertAlmostEqual(g0["pao2"], g0["alveolar_po2"], places=8)
        blocked = replace(self.lung, perfusion=(0, 0, 1))
        g1 = m.gas_exchange(blocked, self.vent, self.state, self.gas)
        self.assertAlmostEqual(g1["sao2"], self.gas.svo2, places=10)

    def test_more_shunt_reduces_oxygenation(self):
        a = replace(self.lung, perfusion=(0.9, 0, 0.1))
        b = replace(self.lung, perfusion=(0.6, 0, 0.4))
        ga = m.gas_exchange(a, self.vent, self.state, self.gas)
        gb = m.gas_exchange(b, self.vent, self.state, self.gas)
        self.assertGreater(ga["pao2"], gb["pao2"])

    def test_co2_alveolar_ventilation_identity(self):
        a = m.gas_exchange(self.lung, self.vent, self.state, self.gas)
        b = m.gas_exchange(self.lung, replace(self.vent, rr=40),
                          self.state, self.gas)
        self.assertAlmostEqual(a["paco2"], 2 * b["paco2"], places=10)
        self.assertGreater(b["ph_fixed_bicarbonate"],
                           a["ph_fixed_bicarbonate"])

    def test_invalid_gas_boundary_rejected(self):
        with self.assertRaises(ValueError):
            m.gas_exchange(self.lung, replace(self.vent, rr=2, fio2=0.21),
                           self.state, self.gas)

    def test_power_against_independent_closed_form(self):
        # One open exponential spring has an analytic pressure-work integral.
        lung = m.Lung(tissue=(1, 0, 0), perfusion=(1, 0, 0), aop=0)
        state = m.empty_state(lung)
        row = m.mechanics(lung, self.vent, state, n=480)
        capacity = lung.c_specific * lung.k_normal
        v0 = capacity * (1 - math.exp(-self.vent.peep / lung.k_normal))
        v1 = v0 + self.vent.vt

        def primitive(v):
            return lung.k_normal * ((capacity - v)
                    * math.log1p(-v / capacity) - (capacity - v))

        area = (primitive(v1) - primitive(v0)
                + lung.resistance * self.vent.flow * self.vent.vt)
        expected = m.J_PER_L_CMH2O * self.vent.rr * area
        self.assertLess(abs(row["mp_integral_J_min"] - expected), 1e-5)

    def test_quadrature_convergence(self):
        values = [m.mechanics(self.lung, self.vent, self.state, n=n)
                  ["mp_integral_J_min"] for n in (120, 240, 480)]
        self.assertLess(abs(values[2] - values[1]),
                        abs(values[1] - values[0]))
        self.assertLess(abs(values[2] - values[1]), 1e-4)

    def test_resistance_changes_peak_and_work_not_plateau(self):
        a = m.mechanics(self.lung, self.vent, self.state)
        b = m.mechanics(replace(self.lung, resistance=20),
                        self.vent, self.state)
        self.assertAlmostEqual(a["pplat"], b["pplat"])
        self.assertAlmostEqual(b["ppeak"] - a["ppeak"], 5)
        self.assertGreater(b["mp_integral_J_min"], a["mp_integral_J_min"])

    def test_known_linear_ri_cases(self):
        # C=.04, pressure drop=10: baseline inflation=.4 L.
        self.assertAlmostEqual(m.ri_from_endpoints(0.6, 0.2, .04, 15, 5)
                               ["ri_signed"], 0, places=12)
        self.assertAlmostEqual(m.ri_from_endpoints(0.8, 0.2, .04, 15, 5)
                               ["ri_signed"], .5, places=12)
        self.assertAlmostEqual(m.ri_from_endpoints(1.0, 0.2, .04, 15, 5)
                               ["ri_signed"], 1, places=12)

    def test_signed_ri_not_clipped(self):
        row = m.ri_from_endpoints(0.5, 0.2, .04, 15, 5)
        self.assertAlmostEqual(row["ri_signed"], -.25)

    def test_aop_endpoint_and_invalid_cases(self):
        row = m.ri_analogue(replace(self.lung, aop=6))
        self.assertEqual(row["effective_low"], 6)
        self.assertEqual(row["delta_p"], 9)
        for aop in (15, 16):
            self.assertFalse(m.ri_analogue(replace(self.lung, aop=aop))
                             ["valid"])

    def test_ri_exact_volume_decomposition(self):
        row = m.ri_analogue(self.lung)
        self.assertAlmostEqual(row["delta_eelv_L"],
            row["model_recruitment_volume_L"]
            + row["nonlinear_inflation_volume_L"], places=12)
        self.assertAlmostEqual(row["ri_signed"],
            row["recruitment_component"]
            + row["nonlinear_baseline_component"], places=12)

    def test_no_recruitable_tissue_has_zero_true_recruitment(self):
        lung = replace(self.lung, tissue=(.8, 0, .2),
                       perfusion=(.8, 0, .2))
        row = m.ri_analogue(lung)
        self.assertAlmostEqual(row["model_recruitment_volume_L"], 0)
        # R/I-style index need not be zero for a nonlinear elastic spring.

    def test_peep_trial_flags_boundary_and_aop_exclusion(self):
        lung = replace(self.lung, tissue=(1, 0, 0),
                       perfusion=(1, 0, 0), aop=6)
        trial = m.peep_trial(lung, self.vent)
        self.assertTrue(trial["boundary"])
        self.assertEqual(trial["max_crs_peeps"], [6])
        self.assertFalse(trial["rows"][-1]["valid"])

    def test_grid_never_selects_infeasible_candidate(self):
        grid = m.candidate_grid(self.lung, self.vent, self.gas,
                               [(10, .55), (20, .8)], max_plateau=1)
        self.assertEqual(grid["status"], "no_feasible_candidate")
        self.assertIsNone(grid["minimum_model_mp_candidate"])
        grid = m.candidate_grid(self.lung, self.vent, self.gas,
                               [(10, .55), (20, .8)], max_plateau=100,
                               min_sao2=.5, min_ph=6)
        best = grid["minimum_model_mp_candidate"]
        self.assertIsNotNone(best)
        self.assertTrue(best["feasible"])


if __name__ == "__main__":
    unittest.main()
