import hashlib
import json
import math
import tempfile
import unittest
from pathlib import Path

import convert_garmentcode as code
from audit_library import inspect


class GarmentCodeConversionTests(unittest.TestCase):
    def test_relative_cubic_and_quadratic(self):
        a, b = (0., 0.), (10., 0.)
        self.assertEqual(code.control_point(a, b, [0.5, 0.2]), (5., 2.))
        mid = code.bezier(a, b, [(5., 2.)], .5)
        self.assertAlmostEqual(mid[0], 5.)
        self.assertAlmostEqual(mid[1], 1.)
        mid2 = code.bezier(a, b, [(1., 1.), (9., 1.)], .5)
        self.assertAlmostEqual(mid2[0], 5.)
        self.assertAlmostEqual(mid2[1], .75)

    def test_circular_svg_arc_right_flag_is_inverted(self):
        a, b = (0., 0.), (10., 0.)
        one = code.arc_points(a, b, [6., 0, 1])
        other = code.arc_points(a, b, [6., 0, 0])
        self.assertAlmostEqual(one[0][0], a[0], places=7)
        self.assertAlmostEqual(one[-1][0], b[0], places=7)
        self.assertGreater(len(one), 13)
        self.assertLess(one[len(one)//2][1] * other[len(other)//2][1], 0)
        self.assertTrue(all(math.isfinite(c) for p in one+other for c in p))

    def test_all_authored_panels_close_without_mutating_sources(self):
        manifest = json.loads(code.MANIFEST.read_text())
        self.assertEqual(len(manifest), 36)
        by_source = {key: 0 for key in code.SPECS}
        for spec in code.SPECS:
            file = code.SOURCES/(spec+'_specification.json')
            before = file.read_bytes()
            document = json.loads(before)
            panels = document['pattern']['panels']
            self.assertGreater(len(panels), 3)
            for panel in panels.values():
                samples = code.sample_panel(panel)
                self.assertGreater(len(samples), 3)
            self.assertEqual(before, file.read_bytes())
            with tempfile.TemporaryDirectory() as temp:
                outputs = code.convert_spec(file, Path(temp)/spec)
                self.assertEqual(len(outputs), len(panels)+1)
                self.assertTrue(all(inspect(out.read_bytes())['envelopeOK'] for out in outputs))
                self.assertEqual(before, file.read_bytes())
            by_source[spec] = len(outputs)
        self.assertEqual(by_source, {'dress_pencil':7,'hoody_mean':7,'js_mean_all':13,'shirt_mean':9})
        for entry in manifest:
            output = code.ROOT/entry['filename']
            self.assertEqual(hashlib.sha256(output.read_bytes()).hexdigest(),entry['sha256'])
            self.assertFalse(entry['factoryApproved'])


if __name__ == '__main__': unittest.main()
