import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from remote_garmentcode_seam_select import pick_model,best_prior_on_validation,completed_models


class ModelSelectionSafetyTests(unittest.TestCase):
    def test_deep_checkpoint_not_promoted_using_its_seen_validation_examples(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            for name in ('remote-seam-full-124678','remote-seam-deep-124678'):
                d=root/name
                d.mkdir()
                (d/'seam-compatibility-v1.npz').write_bytes(b'fixture')
                (d/'training-manifest.json').write_text(json.dumps({
                    'schema':'exo.garmentcodedata-v2.seam-compatibility.v1',
                    'verifiedGarmentsRead':124678}))
            with patch('remote_garmentcode_seam_select.load_model',return_value={}):
                versions=completed_models(root)
            self.assertEqual(len(versions),1)
            self.assertEqual(versions[-1][1].parent.name,'remote-seam-full-124678')

    def test_choose_best_old_checkpoint_by_validation_not_training_count(self):
        values={'old-10k':{'top1PartnerRecall':0.84,'meanReciprocalRank':0.90},
                'best-20k':{'top1PartnerRecall':0.88,'meanReciprocalRank':0.91},
                'regressed-30k':{'top1PartnerRecall':0.85,'meanReciprocalRank':0.93}}
        winner,score,results=best_prior_on_validation(
            [(10000,'old-10k'),(20000,'best-20k'),(30000,'regressed-30k')],
            lambda checkpoint: values[checkpoint])
        self.assertEqual(winner,(20000,'best-20k'))
        self.assertEqual(score['top1PartnerRecall'],0.88)
        self.assertEqual(len(results),3)

    def test_use_validation_top_one_with_mrr_only_for_ties(self):
        prior={'top1PartnerRecall':0.91,'meanReciprocalRank':0.95}
        self.assertTrue(pick_model({'top1PartnerRecall':0.92,'meanReciprocalRank':0.90},prior))
        self.assertFalse(pick_model({'top1PartnerRecall':0.90,'meanReciprocalRank':0.99},prior))
        self.assertTrue(pick_model({'top1PartnerRecall':0.91,'meanReciprocalRank':0.96},prior))
        self.assertFalse(pick_model({'top1PartnerRecall':0.91,'meanReciprocalRank':0.95},prior))
        self.assertTrue(pick_model({'top1PartnerRecall':0.01,'meanReciprocalRank':0.01},None))


if __name__=='__main__':unittest.main()
