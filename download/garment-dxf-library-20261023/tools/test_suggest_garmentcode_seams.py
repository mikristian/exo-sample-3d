import tempfile
import unittest
from pathlib import Path

import numpy as np

from suggest_garmentcode_seams import load_model,rank_matches,evaluate_test_set
from train_garmentcode_seams import FEATURE_NAMES


def fixture():
    panel={'label':'body','vertices':[[0,0],[12,0],[12,5],[0,5]],
           'edges':[{'endpoints':[0,1]},{'endpoints':[1,2]},
                    {'endpoints':[2,3]},{'endpoints':[3,0]}]}
    return {'pattern':{'panels':{'front':dict(panel),'back':dict(panel)},
                       'stitches':[[{'panel':'front','edge':0},{'panel':'back','edge':2}]]}}


class SeamSuggestionTests(unittest.TestCase):
    def test_validation_or_test_split_is_required(self):
        with self.assertRaisesRegex(ValueError,'split'):
            evaluate_test_set(Path('unused'),None,Path('unused'),1,'train')

    def test_read_only_ranking_and_exclusion(self):
        model={'mean':np.zeros(len(FEATURE_NAMES)),
               'std':np.ones(len(FEATURE_NAMES)),
               'w1':np.zeros((len(FEATURE_NAMES),32)),
               'b1':np.zeros(32),
               'w2':np.zeros((32,1)),
               'b2':np.zeros(1)}
        original=fixture()
        import json
        before=json.dumps(original,sort_keys=True)
        items=rank_matches(original,'front',0,model,top_k=12)
        self.assertEqual(len(items),7)
        self.assertIn({'panel':'back','edge':2,'rankingScore':0.5,'chordLength':12},items)
        excluded=rank_matches(original,'front',0,model,top_k=12,include_existing=False)
        self.assertEqual(len(excluded),6)
        self.assertNotIn(('back',2),{(item['panel'],item['edge']) for item in excluded})
        self.assertEqual(json.dumps(original,sort_keys=True),before)

    def test_reject_incompatible_checkpoint_schema(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'bad.npz'
            np.savez_compressed(path,featureNames=np.asarray(list(reversed(FEATURE_NAMES))))
            with self.assertRaisesRegex(ValueError,'incompatible'):
                load_model(path)


if __name__=='__main__':unittest.main()
