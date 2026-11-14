"""Check model selection across completed, incomplete and incompatible archives."""
import json
import tempfile
import unittest
from importlib.machinery import SourceFileLoader
from pathlib import Path

import numpy as np


HERE = Path(__file__).resolve().parent
selector = SourceFileLoader('trained_geometry_selection_test',
    str(HERE / 'trained-geometry-index-20261103.py')).load_module()


def make(root, directory, ids, *, corrupt=False, incomplete=False):
    folder = Path(root) / 'training' / directory
    folder.mkdir(parents=True)
    manifest = {
        'schema': 'exo.garmentcodedata-v2.geometry-training.v1',
        'modelType': 'self-supervised masked geometry feature encoder',
        'trainingExamplesVerified': len(ids),
    }
    (folder / 'training-manifest.json').write_text(json.dumps(manifest))
    arrays = {name: np.ones(shape, dtype=np.float32)
              for name, shape in selector.MODEL_SHAPES.items()}
    arrays['featureNames'] = np.asarray([f'f{i}' for i in range(39)])
    np.savez(folder / 'geometry-encoder-v1.npz', **arrays)
    if not incomplete:
        vectors = np.ones((len(ids), 16), dtype=np.float32)
        if corrupt:
            vectors[-1, -1] = np.nan
        np.savez(folder / 'source-embeddings-v1.npz',
                 sourceIds=np.asarray(ids), embeddings=vectors)


class CheckpointSelectionTests(unittest.TestCase):
    def test_prefers_larger_verified_model(self):
        with tempfile.TemporaryDirectory() as tmp:
            make(tmp, 'geometry-encoder-full-archive', ['default/00/a'])
            make(tmp, 'remote-geometry-71k', ['default/00/a', 'default/00/b'])
            selected = selector.best(tmp, 'default/00/a')
            self.assertEqual(selected['count'], 2)
            self.assertEqual(selected['checkpointDirectory'], 'remote-geometry-71k')

    def test_falls_back_if_larger_model_does_not_include_requested_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            make(tmp, 'geometry-encoder-full-archive', ['default/00/a'])
            make(tmp, 'remote-geometry-71k', ['default/00/b', 'default/00/c'])
            selected = selector.best(tmp, 'default/00/a')
            self.assertEqual(selected['count'], 1)
            self.assertIsNone(selector.best(tmp, 'default/00/missing'))

    def test_rejects_missing_corrupt_and_duplicate_embeddings(self):
        with tempfile.TemporaryDirectory() as tmp:
            make(tmp, 'geometry-encoder-full-archive', ['default/00/good'])
            make(tmp, 'remote-geometry-71k', ['default/00/bad', 'default/00/bad'])
            make(tmp, 'remote-geometry-90k', ['default/00/bad', 'default/00/other', 'default/00/third'], corrupt=True)
            make(tmp, 'remote-geometry-full-150k', ['default/00/other'] * 4, incomplete=True)
            selected = selector.best(tmp)
            self.assertEqual(selected['count'], 1)
            self.assertEqual(selected['checkpointDirectory'], 'geometry-encoder-full-archive')

    def test_live_verified_checkpoint_uses_largest_available_compatible_index(self):
        root = HERE.parents[1] / 'download/garment-dxf-library-20261023/garmentcodedata-v2'
        if not (root / 'training/remote-geometry-71k/source-embeddings-v1.npz').is_file():
            self.skipTest('Optional local trained archive not installed')
        selected = selector.best(root, 'default/00/rand_00YONAPXZE')
        self.assertGreaterEqual(selected['count'], 73069)


if __name__ == '__main__':
    unittest.main()
