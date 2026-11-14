import importlib.util
import json
import hashlib
import sqlite3
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name('pattern-source-geometry-20261102.py')
spec = importlib.util.spec_from_file_location('source_geometry_test_module', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ArchiveGeometryTests(unittest.TestCase):
    def test_real_source_with_provenance_and_seams(self):
        result = module.decode('default/00/rand_00YONAPXZE')
        self.assertTrue(result['verified'])
        self.assertEqual(len(result['panels']), 18)
        self.assertEqual(len(result['seams']), 54)
        self.assertEqual(result['spec']['properties']['units_in_meter'], 100)
        self.assertFalse(result['factoryApproved'])
        self.assertEqual(result['sourceSha256'], result['source']['sha256'])
        for pair in result['seams']:
            for side in pair:
                self.assertLess(side['edge'], len(result['spec']['pattern']['panels'][side['panel']]['edges']))

    def test_rejects_unsafe_id(self):
        with self.assertRaisesRegex(module.DecodeError, 'invalid_source_id'):
            module.decode('../../etc/passwd')

    def test_rejects_hash_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            with sqlite3.connect(root / 'pattern-index.sqlite3') as db:
                db.execute('CREATE TABLE patterns (body TEXT, batch INTEGER, element TEXT, source_path TEXT, sha256 TEXT, bytes INTEGER, license TEXT, attribution TEXT, source TEXT)')
                db.execute('INSERT INTO patterns VALUES (?,?,?,?,?,?,?,?,?)', ('default', 0, 'test', 'fake.json', '0' * 64, 2, '', '', ''))
            (root / 'fake.json').write_text('{}')
            with self.assertRaisesRegex(module.DecodeError, 'source_hash_mismatch'):
                module.decode('default/00/test', root)

    def test_permuted_and_reversed_edges_preserve_seam_indices(self):
        sample = {'properties': {'units_in_meter': 100, 'curvature_coords': 'relative', 'normalized_edge_loops': True},
                  'pattern': {'panels': {'A': {'vertices': [[0,0],[2,0],[2,2],[0,2]],
                                            'edges': [{'endpoints':[2,3]}, {'endpoints':[1,0]},
                                                      {'endpoints':[3,0]}, {'endpoints':[1,2]}]}},
                              'stitches': [[{'panel':'A','edge':0},{'panel':'A','edge':2}]]}}
        raw = json.dumps(sample).encode()
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/'sample.json').write_bytes(raw)
            with sqlite3.connect(root/'pattern-index.sqlite3') as db:
                db.execute('CREATE TABLE patterns (body TEXT, batch INTEGER, element TEXT, source_path TEXT, sha256 TEXT, bytes INTEGER, license TEXT, attribution TEXT, source TEXT)')
                db.execute('INSERT INTO patterns VALUES (?,?,?,?,?,?,?,?,?)',('default',0,'sample','sample.json',hashlib.sha256(raw).hexdigest(),len(raw),'test','','test'))
            result=module.decode('default/00/sample',root)
            self.assertEqual(result['spec']['pattern']['panels']['A']['edges'][0]['endpoints'],[2,3])
            self.assertEqual(result['spec']['pattern']['stitches'][0][0]['edge'],0)
            self.assertFalse(result['exoQaPassed'])


if __name__ == '__main__':
    unittest.main()
