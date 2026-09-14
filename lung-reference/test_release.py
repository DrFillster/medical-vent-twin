"""Release contract and stricter verification regression tests."""
from dataclasses import replace
import math
import unittest
import lung_reference as M
from cross_check import compare

class ReleaseTests(unittest.TestCase):
    def test_comparator_rejects_missing_keys(self):
        with self.assertRaises(AssertionError):compare({'pplat':1},{})
    def test_comparator_rejects_nonfinite(self):
        for n in [math.nan,math.inf,-math.inf]:
            with self.assertRaises(AssertionError):compare(n,n)
    def test_comparator_rejects_boolean_number(self):
        with self.assertRaises(AssertionError):compare(True,1)
    def test_comparator_rejects_changed_relay_vector(self):
        with self.assertRaises(AssertionError):compare([True,False],[False,True])
    def test_comparator_mixed_tolerance_is_explicit(self):
        compare(1000,1000.0000001)
        with self.assertRaises(AssertionError):compare(1000,1000.01)
    def test_numeric_booleans_rejected(self):
        with self.assertRaises(ValueError):M.Vent(vt=True)
    def test_fraction_inputs_copied_to_immutable_tuple(self):
        f=[.4,.4,.2];l=M.Lung(tissue=f);f[0]=.8
        self.assertEqual(l.tissue,(.4,.4,.2))
    def test_unknown_fields_rejected(self):
        with self.assertRaises(TypeError):M.Vent(fio=.9)
    def test_relay_resource_limit(self):
        with self.assertRaises(ValueError):M.Lung(units=100000)
    def test_no_valid_sweep_has_label(self):
        l=M.Lung(tissue=(0,0,1),perfusion=(0,0,1))
        t=M.peep_trial(l,M.Vent())
        self.assertEqual(t['max_crs_peeps'],[]);self.assertIsNone(t['boundary'])
        self.assertIn('not recommended',t['label'])
    def test_no_recruitment_stiffening_can_have_signed_bias(self):
        _,l,v,g=M.illustrative_cases()[0];r=M.ri_analogue(l,vt=v.vt)
        self.assertEqual(r['model_recruitment_volume_L'],0)
        self.assertLess(r['ri_signed'],0)
        self.assertAlmostEqual(r['ri_signed'],r['recruitment_component']+r['nonlinear_baseline_component'])
    def test_history_is_a_material_input(self):
        _,l,v,g=M.illustrative_cases()[3]
        a=M.evaluate(l,v,g,[v.peep]);b=M.evaluate(l,v,g,[30,v.peep])
        self.assertGreater(a['pplat'],b['pplat'])
        self.assertGreater(a['effective_shunt'],b['effective_shunt'])

if __name__=='__main__':unittest.main()
