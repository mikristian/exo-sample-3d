#!/usr/bin/env python3
"""Focused neural contour decoder tests, including an actual verified archive example."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('exo_contour_decoder', HERE/'exo_contour_decoder_20261102.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ContourDecoderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.samples, cls.names = module.datasets(module.DEFAULT_ROOT)

    def test_train_honest_holdouts_and_finite_model(self):
        weights, mean, scale, metrics = module.train_arrays(self.samples, epochs=35, seed=12)
        partitions = [set(group) for group in metrics['splits'].values()]
        self.assertTrue(all(not a.intersection(b) for i,a in enumerate(partitions) for b in partitions[i+1:]))
        self.assertEqual(set.union(*partitions), set(s[0] for s in self.samples))
        self.assertGreater(len(metrics['splits']['test']), 2)
        self.assertTrue(np.isfinite(np.stack([metrics['vertexControlRmseCm'][k] for k in ('train','val','test')])).all())
        self.assertTrue(all(np.isfinite(value).all() for value in weights.values()))
        self.assertEqual(mean.shape,scale.shape)

    def test_actual_archive_model_inference_preserves_topology_and_stitches(self):
        checkpoint=module.DEFAULT_OUTPUT/'model.npz'
        manifest=json.loads((checkpoint.parent/'manifest.json').read_text())
        with np.load(checkpoint,allow_pickle=False) as raw:
            weights={key:raw[key] for key in ('W1','b1','W2','b2','W3','b3','W4','b4')}
            mean=raw['mean']; scale=raw['scale']
        sid, original, _ = self.samples[0]
        self.assertEqual(module.family_key(original),module.family_key(manifest['template']))
        generated,diagnostics=module.generate(original,weights,mean,scale,manifest['panelOrder'],22,.12)
        self.assertEqual(module.family_key(generated),module.family_key(original))
        self.assertEqual(generated['pattern']['stitches'],original['pattern']['stitches'])
        self.assertTrue(diagnostics['basicGeometryValid'])
        self.assertGreater(diagnostics['inputReconstructionAndGenerationRmseCm'],1e-6)
        self.assertNotEqual(module.pack(generated,self.names).tolist(),module.pack(original,self.names).tolist())
        repeated,_=module.generate(original,weights,mean,scale,manifest['panelOrder'],22,.12)
        np.testing.assert_array_equal(module.pack(repeated,self.names),module.pack(generated,self.names))

    def test_reject_nonmatching_family(self):
        _,doc,_=self.samples[0]
        mutated=json.loads(json.dumps(doc))
        mutated['pattern']['stitches'].pop()
        self.assertNotEqual(module.family_key(mutated),module.family_key(doc))
        with self.assertRaises(ValueError):
            module.pack({'pattern':{'panels':{'fake':{'vertices':[['x',2]],'edges':[]}}}},['fake'])


if __name__ == '__main__':
    unittest.main()
