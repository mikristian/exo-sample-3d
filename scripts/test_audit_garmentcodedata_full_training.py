import hashlib
import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

import numpy as np


spec=importlib.util.spec_from_file_location('exo_full_training_audit',
    Path(__file__).with_name('audit-garmentcodedata-full-training.py'))
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def fixture_model(path,kind):
    features=(mod.GEOMETRY_FEATURE_NAMES if kind=='geometry' else mod.SEAM_FEATURE_NAMES)
    n=len(features)
    if kind=='geometry':
        dims=(n,64,16,64,n)
    else:
        dims=(n,32,1)
    arrays={'featureNames':np.asarray(features), 'mean':np.zeros(n,dtype=np.float32),
            'std':np.ones(n,dtype=np.float32)}
    for i in range(1,len(dims)):
        arrays[f'w{i}']=np.zeros((dims[i-1],dims[i]),dtype=np.float32)
        arrays[f'b{i}']=np.zeros(dims[i],dtype=np.float32)
    np.savez_compressed(path,**arrays)


class FullTrainingAuditTests(unittest.TestCase):
    def test_corrupt_checkpoint_never_counts_as_trained(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            geom=root/'geometry.npz'
            seam=root/'seam.npz'
            fixture_model(geom,'geometry')
            fixture_model(seam,'seam')
            self.assertTrue(mod.valid_model_checkpoint(geom,'geometry'))
            self.assertTrue(mod.valid_model_checkpoint(seam,'seam'))
            geom.write_bytes(b'corrupt')
            self.assertFalse(mod.valid_model_checkpoint(geom,'geometry'))
            with np.load(seam,allow_pickle=False) as doc:
                arrays={key:doc[key].copy() for key in doc.files}
            arrays['std'][0]=0
            np.savez_compressed(seam,**arrays)
            self.assertFalse(mod.valid_model_checkpoint(seam,'seam'))

    def test_deep_checkpoints_never_replace_independent_first_pass(self):
        with tempfile.TemporaryDirectory() as temp:
            training=Path(temp)
            for prefix,count_key in (('remote-geometry','trainingExamplesVerified'),
                                     ('remote-seam','verifiedGarmentsRead')):
                first=training/f'{prefix}-full-2'
                deep=training/f'{prefix}-deep-2'
                first.mkdir()
                deep.mkdir()
                (first/'training-manifest.json').write_text(json.dumps({count_key:2,
                    'metrics':{'heldoutMetricsIndependent':True}}))
                (deep/'training-manifest.json').write_text(json.dumps({count_key:2,
                    'metrics':{'heldoutMetricsIndependent':False}}))
                found=mod.latest_manifest(training,prefix)
                self.assertEqual(found[1], first/'training-manifest.json')

    def test_source_ids_and_training_manifests_prove_exact_set_coverage(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            db=sqlite3.connect(root/'pattern-index.sqlite3')
            db.execute('CREATE TABLE patterns(body TEXT,batch INTEGER,element TEXT)')
            db.execute('CREATE TABLE archived_batches(body TEXT,batch INTEGER,specification_count INTEGER)')
            db.executemany('INSERT INTO patterns VALUES (?,?,?)',
                           [('default',0,'a'),('default',0,'b')])
            db.execute('INSERT INTO archived_batches VALUES (?,?,?)',('default',0,2))
            db.commit();db.close()
            geom=root/'training/remote-geometry-2k';geom.mkdir(parents=True)
            (geom/'training-manifest.json').write_text(json.dumps({'trainingExamplesVerified':2}))
            fixture_model(geom/'geometry-encoder-v1.npz','geometry')
            ids=np.asarray(['default/00/a','default/00/b'])
            np.savez_compressed(geom/'source-embeddings-v1.npz',sourceIds=ids,
                                embeddings=np.ones((2,16),dtype=np.float32))
            seam=root/'training/remote-seam-2k';seam.mkdir()
            fixture_model(seam/'seam-compatibility-v1.npz','seam')
            fingerprint=mod.source_id_fingerprint(set(map(str,ids)))
            (seam/'training-manifest.json').write_text(json.dumps({
                'verifiedGarmentsRead':2,'garmentsWithUsableStitches':2,
                'verifiedSourceIDsXorSha256':fingerprint}))
            result=mod.audit(root)
            self.assertTrue(result['geometry']['matchesEveryIndexedSource'])
            self.assertTrue(result['seam']['matchesEveryIndexedSource'])
            self.assertFalse(result['allSourcePatternsCoveredByBothModels']) # still missing 39 source batches
            np.savez_compressed(geom/'source-embeddings-v1.npz',
                                sourceIds=np.asarray(['default/00/a','random/00/other']),
                                embeddings=np.ones((2,16),dtype=np.float32))
            self.assertFalse(mod.audit(root)['geometry']['matchesEveryIndexedSource'])

    def test_duplicate_archive_rows_do_not_count_as_more_batches(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            with sqlite3.connect(root/'pattern-index.sqlite3') as db:
                db.execute('CREATE TABLE patterns(body TEXT,batch INTEGER,element TEXT)')
                db.execute('CREATE TABLE archived_batches(body TEXT,batch INTEGER,specification_count INTEGER)')
                db.executemany('INSERT INTO archived_batches VALUES (?,?,?)',
                               [('default',0,1),('default',0,1),('random',0,1)])
            _,_,batches,distinct=mod.catalog_ids(root)
            self.assertEqual(batches,{'default':1,'random':1})
            self.assertEqual(distinct,{('default',0),('random',0)})

    def test_malformed_seam_fingerprint_yields_unverified_not_error(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            with sqlite3.connect(root/'pattern-index.sqlite3') as db:
                db.execute('CREATE TABLE patterns(body TEXT,batch INTEGER,element TEXT)')
                db.execute('CREATE TABLE archived_batches(body TEXT,batch INTEGER,specification_count INTEGER)')
                db.execute('INSERT INTO patterns VALUES (?,?,?)',('default',0,'a'))
                db.execute('INSERT INTO archived_batches VALUES (?,?,?)',('default',0,1))
            seam=root/'training/remote-seam-test'
            seam.mkdir(parents=True)
            (seam/'training-manifest.json').write_text(json.dumps({
                'verifiedGarmentsRead':1,'verifiedSourceIDsXorSha256':42}))
            fixture_model(seam/'seam-compatibility-v1.npz','seam')
            self.assertFalse(mod.audit(root)['seam']['matchesEveryIndexedSource'])

    def test_second_pass_requires_matching_source_ids_and_complete_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            with sqlite3.connect(root/'pattern-index.sqlite3') as db:
                db.execute('CREATE TABLE patterns(body TEXT,batch INTEGER,element TEXT)')
                db.execute('CREATE TABLE archived_batches(body TEXT,batch INTEGER,specification_count INTEGER)')
                db.execute('INSERT INTO patterns VALUES (?,?,?)',('default',0,'a'))
                db.execute('INSERT INTO archived_batches VALUES (?,?,?)',('default',0,1))
            names=['default/00/a']
            geo=root/'training/remote-geometry-deep-1'
            geo.mkdir(parents=True)
            (geo/'training-manifest.json').write_text(json.dumps({
                'trainingExamplesVerified':1,'metrics':{
                'fullDatasetOptimization':True,'optimizerTrainingExamples':1,
                'heldoutMetricsIndependent':False}}))
            fixture_model(geo/'geometry-encoder-v1.npz','geometry')
            np.savez_compressed(geo/'source-embeddings-v1.npz',
                sourceIds=np.asarray(names),embeddings=np.ones((1,16),dtype=np.float32))
            seam=root/'training/remote-seam-deep-1'
            seam.mkdir()
            fixture_model(seam/'seam-compatibility-v1.npz','seam')
            (seam/'training-manifest.json').write_text(json.dumps({
                'verifiedGarmentsRead':1,'actualPairExamples':10,
                'metrics':{'fullDatasetOptimization':True,'optimizerPairCount':10,
                           'heldoutMetricsIndependent':False},
                'verifiedSourceIDsXorSha256':mod.source_id_fingerprint(names)}))
            first=mod.audit(root)
            self.assertTrue(first['secondDeepPass']['geometry']['verified'])
            self.assertTrue(first['secondDeepPass']['seam']['verified'])
            self.assertFalse(first['allSourcePatternsDeepTrained']) # Missing 39 source batches
            (seam/'training-manifest.json').write_text(json.dumps({
                'verifiedGarmentsRead':1,'verifiedSourceIDsXorSha256':'0'*64}))
            self.assertFalse(mod.audit(root)['secondDeepPass']['seam']['verified'])


if __name__=='__main__':unittest.main()
