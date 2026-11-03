"""Smoke and safety checks against SHA-verified original GarmentCodeData examples."""
import importlib.machinery
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
synthesis = importlib.machinery.SourceFileLoader('synthesis_under_test', str(HERE / 'pattern-synthesis-model-20261102.py')).load_module()


class SynthesisTests(unittest.TestCase):
    source = 'default/00/rand_04IMMO8WDD'
    donor = 'default/00/rand_0BVS2KDJ6H'

    def test_real_learned_conditioned_contour_proposal(self):
        original = synthesis.geometry.decode(self.source, root=synthesis.ROOT)
        result = synthesis.propose(self.source, donor_id=self.donor)
        self.assertTrue(result['ok'])
        self.assertGreater(result['changedPanels'], 0)
        self.assertEqual(result['donorSourceId'], self.donor)
        self.assertEqual(result['sourceSha256'], original['sourceSha256'])
        self.assertEqual(synthesis.graph_signature(result['spec']['pattern']),
                         synthesis.graph_signature(original['spec']['pattern']))
        self.assertEqual(len(result['seamModelAssessments']), len(original['seams']))
        self.assertNotEqual(result['spec']['pattern']['panels'], original['spec']['pattern']['panels'])
        self.assertFalse(result['trainedContourDecoder'])
        self.assertFalse(result['exoQaPassed'])
        self.assertFalse(result['editableCandidateReady'])

    def test_rejects_invalid_blend_and_incompatible_donor(self):
        with self.assertRaisesRegex(ValueError, 'blend_must_be'):
            synthesis.propose(self.source, blend=0)
        with self.assertRaisesRegex(ValueError, 'no_compatible'):
            synthesis.propose(self.source, donor_id='default/00/rand_00YONAPXZE')

    def test_actual_trained_embedding_neighbor_selection(self):
        result = synthesis.propose(self.source)
        self.assertTrue(result['ok'])
        self.assertNotEqual(result['donorSourceId'], self.source)
        self.assertGreater(result['embeddingCosineSimilarity'], 0)
        self.assertGreater(result['changedPanels'], 0)
        self.assertEqual(result['geometryTrainingExamplesVerified'], 50036)
        self.assertIn('remote-seam-40k', result['seamCheckpoint'])

    def test_donor_path_traversal_is_rejected(self):
        for donor in ('../outside', 'default/00/../../etc', '/etc/passwd'):
            with self.subTest(donor=donor), self.assertRaisesRegex(ValueError, 'invalid_donor_source_id'):
                synthesis.propose(self.source, donor_id=donor)


if __name__ == '__main__':
    unittest.main()
