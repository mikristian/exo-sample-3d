"""Focused graph safety, source integrity and learned-ranking tests."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import sqlite3
import hashlib

import numpy as np

PATH = Path(__file__).with_name('seam-prediction-research-20261102.py')
spec = importlib.util.spec_from_file_location('exo_seam_research_test', PATH)
research = importlib.util.module_from_spec(spec)
spec.loader.exec_module(research)


class MockTraining:
    @staticmethod
    def collect_edge_records(doc):
        return {('A', 0): {'length': 10}, ('B', 0): {'length': 10.2}, ('C', 0): {'length': 30}}

    @staticmethod
    def pair_features(a, b):
        return np.asarray([min(a['length'], b['length']), max(a['length'], b['length'])] + [0] * 31, dtype=np.float32)


class SeamPredictionTests(unittest.TestCase):
    def setUp(self):
        self.model = {'mean': np.zeros(33), 'std': np.ones(33),
                      'w1': np.zeros((33, 32)), 'b1': np.zeros(32),
                      'w2': np.zeros((32, 1)), 'b2': np.zeros(1)}
        self.doc = {'pattern': {'stitches': [[{'panel': 'A', 'edge': 0}, {'panel': 'B', 'edge': 0}, 'right_wrong']]}}

    def test_anchor_preserved_and_cannot_be_proposed(self):
        result = research.predict(self.doc, self.model, MockTraining)
        self.assertEqual(len(result['sourceAnchors']), 1)
        self.assertEqual(result['eligibleUnpairedEdges'], 1)
        self.assertFalse(result['proposals'])
        self.assertTrue(result['sourceAnchorsPreserved'])

    def test_hidden_stitches_allow_candidates_and_flag_length(self):
        result = research.predict(self.doc, self.model, MockTraining, anchors_enabled=False)
        self.assertEqual(result['totalScoredPairs'], 3)
        self.assertEqual(result['proposals'][0]['rank'], 1)
        self.assertTrue(any(item['lengthWarning'] for item in result['proposals']))
        self.assertTrue(all(item['status'] == 'predicted_unapproved_candidate' for item in result['proposals']))

    def test_candidate_bound_rejects_oversized(self):
        with self.assertRaisesRegex(ValueError, 'candidate_count_outside_bound'):
            research.predict(self.doc, self.model, MockTraining, anchors_enabled=False, max_pairs=2)

    def test_source_sha_verification_and_path_safety(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'specifications').mkdir()
            raw = json.dumps(self.doc).encode()
            (root / 'specifications/test.json').write_bytes(raw)
            with sqlite3.connect(root / 'pattern-index.sqlite3') as db:
                db.execute('CREATE TABLE patterns (body TEXT, batch INT, element TEXT, source_path TEXT, sha256 TEXT, bytes INT)')
                db.execute('INSERT INTO patterns VALUES (?,?,?,?,?,?)',
                           ('default', 0, 'example', 'specifications/test.json', hashlib.sha256(raw).hexdigest(), len(raw)))
            doc, digest = research.read_verified_source(root, 'default/00/example')
            self.assertEqual(doc, self.doc)
            self.assertEqual(digest, hashlib.sha256(raw).hexdigest())
            (root / 'specifications/test.json').write_bytes(b'{}')
            with self.assertRaisesRegex(ValueError, 'source_integrity_failed'):
                research.read_verified_source(root, 'default/00/example')
            with self.assertRaisesRegex(ValueError, 'invalid_source_id'):
                research.read_verified_source(root, '../00/example')


if __name__ == '__main__':
    unittest.main()
