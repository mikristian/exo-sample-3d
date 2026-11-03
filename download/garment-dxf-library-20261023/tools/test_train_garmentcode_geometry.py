import hashlib
import io
import json
import sqlite3
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from ingest_garmentcodedata_v2 import connect_db
from train_garmentcode_geometry import FEATURE_NAMES,features_from_specification,train,verified_examples,load_initial_checkpoint


def example():
    verts=[[0,0],[10,0],[10,12],[0,12]]
    edges=[{'endpoints':[i,(i+1)%4]} for i in range(4)]
    return {'pattern':{'panels':{'front':{'vertices':verts,'edges':edges,'label':'body'},
                                'sleeve':{'vertices':verts,'edges':edges,'label':'arm'}},
                       'stitches':[[1,2],[2,3]]}}


class PatternGeometryTrainingTests(unittest.TestCase):
    def test_deep_refit_optimizes_all_originals_without_claiming_heldout_test(self):
        rng=np.random.default_rng(81)
        x=rng.normal(size=(150,len(FEATURE_NAMES))).astype(np.float32)
        _,_,_,emb,metrics,history=train(x,[f'pattern_{i}' for i in range(150)],
            epochs=3,train_on_all=True)
        self.assertEqual(metrics['optimizerTrainingExamples'],150)
        self.assertEqual(metrics['train'],150)
        self.assertTrue(metrics['fullDatasetOptimization'])
        self.assertFalse(metrics['heldoutMetricsIndependent'])
        self.assertEqual(len(history),3)
        self.assertEqual(emb.shape,(150,16))

    def test_features_are_finite_and_capture_sewing_structure(self):
        spec=example()
        feats=features_from_specification(spec)
        self.assertEqual(len(feats),len(FEATURE_NAMES))
        self.assertTrue(np.isfinite(feats).all())
        self.assertGreater(feats[FEATURE_NAMES.index('stitches_per_panel')],0)
        self.assertAlmostEqual(feats[FEATURE_NAMES.index('arm_panel_fraction')],0.5)

    def test_vectorized_edge_perimeter_preserves_original_geometry_values(self):
        doc=example()
        # Two 10x12 rectangles: the old per-edge norm implementation yields
        # 44 units per panel, 88 total; vectorized chord sums must agree.
        feat=features_from_specification(doc)
        self.assertAlmostEqual(float(feat[FEATURE_NAMES.index('log_total_perimeter')]),
                               float(np.log1p(88.0)),places=6)
        many=example()
        pts=np.array(many['pattern']['panels']['front']['vertices'],dtype=float)
        endpoints=[(i%len(pts),(i+1)%len(pts)) for i in range(1000)]
        many['pattern']['panels']['front']['edges']=[{'endpoints':list(pair)} for pair in endpoints]
        baseline=sum(float(np.linalg.norm(pts[a]-pts[b])) for a,b in endpoints)
        front=np.array(many['pattern']['panels']['front']['edges'],dtype=object)
        self.assertEqual(len(front),1000)
        feature=features_from_specification(many)
        self.assertAlmostEqual(float(feature[FEATURE_NAMES.index('log_total_perimeter')]),
                               float(np.log1p(baseline+44.0)),places=6)
        many['pattern']['panels']['front']['edges'][0]['endpoints']=[0,10000]
        with self.assertRaisesRegex(ValueError,'Invalid sewing edge topology'):
            features_from_specification(many)

    def test_training_performs_heldout_evaluation(self):
        rng=np.random.default_rng(3)
        latent=rng.normal(size=(150,4)).astype(np.float32)
        x=latent@rng.normal(size=(4,len(FEATURE_NAMES))).astype(np.float32)
        weights,mu,sd,emb,metric,history=train(x,[f'element_{i}' for i in range(len(x))],epochs=18)
        self.assertEqual(emb.shape,(len(x),16))
        self.assertTrue(np.isfinite(emb).all())
        self.assertTrue(0<metric['train']<len(x))
        self.assertGreater(metric['validation'],0)
        self.assertGreater(metric['test'],0)
        self.assertGreater(metric['untrainedMeanBaselineTestMSE'],0)
        self.assertLess(metric['testMaskedMSE'],metric['untrainedMeanBaselineTestMSE'])

    def test_optimizer_reports_actual_epochs_without_altering_metrics(self):
        rng=np.random.default_rng(4)
        x=rng.normal(size=(130,len(FEATURE_NAMES))).astype(np.float32)
        events=[]
        _,_,_,_,metrics,history=train(x,[f'garment-{i}' for i in range(len(x))],
                                     epochs=3,progress_callback=events.append)
        self.assertEqual(len(events),len(history))
        self.assertEqual(events[-1]['epoch'],metrics['epochs'])
        self.assertEqual(events[-1]['phase'],'optimizing')
        self.assertGreater(events[-1]['testExamples'],0)

    def test_warm_start_retains_original_model_unless_val_improves(self):
        rng=np.random.default_rng(5)
        x=(rng.normal(size=(180,5))@rng.normal(size=(5,len(FEATURE_NAMES)))).astype(np.float32)
        groups=[f'g-{i}' for i in range(len(x))]
        first,mu,sd,_,first_summary,_=train(x,groups,epochs=12)
        with tempfile.TemporaryDirectory() as directory:
            checkpoint=Path(directory)/'saved.npz'
            np.savez_compressed(checkpoint,**first,mean=mu,std=sd,featureNames=np.asarray(FEATURE_NAMES))
            second,mu2,sd2,_,summary,_=train(x,groups,epochs=12,
                initial_checkpoint=checkpoint,learning_rate=0.0003)
            self.assertEqual(summary['initialTestMaskedMSE'],first_summary['testMaskedMSE'])
            self.assertLessEqual(summary['validationMaskedMSE'],summary['initialValidationMaskedMSE'])
            self.assertTrue(np.allclose(mu,mu2))
            self.assertTrue(np.allclose(sd,sd2))
            self.assertTrue(np.isfinite(second['w1']).all())
            wrong=Path(directory)/'wrong.npz'
            np.savez_compressed(wrong,**first,mean=mu,std=sd,
                featureNames=np.asarray(list(reversed(FEATURE_NAMES))))
            with self.assertRaisesRegex(ValueError,'feature order'):
                load_initial_checkpoint(wrong)

    def test_archive_sources_require_matching_index_hashes(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            src=root/'data'; archive_root=root/'remote'
            db=connect_db(src)
            raw=json.dumps(example()).encode()
            rel='specifications/default/batch-00/example_specification.json'
            sha=hashlib.sha256(raw).hexdigest()
            db.execute('''INSERT INTO patterns
                (body,batch,element,sha256,bytes,panel_count,source_path,source,license,attribution)
                VALUES (?,?,?,?,?,?,?,?,?,?)''',
                ('default',0,'example',sha,len(raw),2,rel,'source','CC BY 4.0','ETH'))
            archive=archive_root/'archives/default/batch-00-specifications.tar.gz'
            archive.parent.mkdir(parents=True)
            with tarfile.open(archive,'w:gz') as writer:
                info=tarfile.TarInfo(rel);info.size=len(raw)
                writer.addfile(info,io.BytesIO(raw))
            digest=hashlib.sha256(archive.read_bytes()).hexdigest()
            db.execute('INSERT INTO archived_batches VALUES (?,?,?,?,?,?)',
                       ('default',0,str(archive),digest,archive.stat().st_size,1))
            db.commit();db.close()
            records=list(verified_examples(src,archive_root))
            self.assertEqual(len(records),1)
            self.assertEqual(records[0][0],'default/00/example')
            archive.write_bytes(archive.read_bytes()+b'bad')
            with self.assertRaisesRegex(ValueError,'Archive size mismatch'):
                list(verified_examples(src,archive_root))


if __name__=='__main__':unittest.main()
