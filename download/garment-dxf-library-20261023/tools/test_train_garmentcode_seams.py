"""Guard against seam-label leakage and non-reproducible geometry features."""
import json
import pathlib
import tempfile
import unittest

import numpy as np

from train_garmentcode_seams import (
    FEATURE_NAMES, _auc, _average_precision, collect_edge_records,
    examples_for_garment, pair_features, train_seams,
)


def pattern():
    def panel(name,y):
        return {'label':'body','translation':[0,y,0],
                'vertices':[[0,0],[20,0],[20,10],[0,10]],
                'edges':[{'endpoints':[0,1]},{'endpoints':[1,2]},
                         {'endpoints':[2,3]},{'endpoints':[3,0]}]}
    return {'pattern':{
        'panels':{'front':panel('front',0),'back':panel('back',20)},
        'stitches':[[{'panel':'front','edge':0},{'panel':'back','edge':2}],
                    [{'panel':'front','edge':2},{'panel':'back','edge':0}]]}}


class SeamCompatibilityTests(unittest.TestCase):
    def test_true_edges_and_hard_negative_pairs_are_separate(self):
        doc=pattern()
        records=collect_edge_records(doc)
        a=records[('front',0)];b=records[('back',2)]
        self.assertTrue(np.allclose(pair_features(a,b),pair_features(b,a)))
        f,y=examples_for_garment(doc,np.random.default_rng(42),negative_ratio=2)
        self.assertEqual(sum(y),2)
        self.assertEqual(y.count(0),4)
        self.assertEqual(len(f),6)
        self.assertTrue(all(v.shape==(len(FEATURE_NAMES),) and np.isfinite(v).all() for v in f))

    def test_deterministic_sampling_and_invalid_stitch_is_excluded(self):
        doc=pattern()
        doc['pattern']['stitches'].append([{'panel':'not-real','edge':9},{'panel':'back','edge':0}])
        f1,y1=examples_for_garment(doc,np.random.default_rng(1))
        f2,y2=examples_for_garment(doc,np.random.default_rng(1))
        self.assertEqual(y1,y2)
        self.assertTrue(np.array_equal(f1,f2))
        self.assertEqual(sum(y1),2)

    def test_auc_and_ap_are_grounded_in_actual_labels(self):
        labels=np.asarray([0,0,1,1])
        self.assertAlmostEqual(_auc(labels,[0.1,0.2,0.9,0.8]),1)
        self.assertAlmostEqual(_average_precision(labels,[0.1,0.2,0.9,0.8]),1)
        self.assertAlmostEqual(_auc(labels,[0.9,0.8,0.1,0.2]),0)

    def test_model_learns_edge_pair_labels_on_garment_disjoint_holdout(self):
        rng=np.random.default_rng(2)
        features=rng.normal(size=(600, len(FEATURE_NAMES))).astype('float32')
        labels=(features[:,7]+features[:,8]*0.7+features[:,14]*0.4>0).astype('float32')
        split=np.tile(np.arange(10),60).astype('uint8')
        model,mean,std,metrics,curve=train_seams(features,labels,split,epochs=20)
        self.assertGreater(metrics['testROCAUC'],0.7)
        self.assertGreater(metrics['testAveragePrecision'],0.7)
        self.assertGreater(metrics['trainingPairCount'],0)
        self.assertTrue(np.isfinite(model['w1']).all())


if __name__=='__main__':unittest.main()
