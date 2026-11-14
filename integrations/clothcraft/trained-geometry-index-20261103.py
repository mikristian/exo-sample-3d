"""Select the largest *locally verified* GarmentCodeData geometry embedding index.

An indexed archive entry is not a training example. This loader accepts only
completed compatible model/embedding/manifest triplets and prefers the newest
*coverage count*, without assuming all archive sources have been trained.
"""
import json
from pathlib import Path

import numpy as np

MODEL_SHAPES = {
    'w1': (39, 64), 'b1': (64,), 'w2': (64, 16), 'b2': (16,),
    'w3': (16, 64), 'b3': (64,), 'w4': (64, 39), 'b4': (39,),
    'mean': (39,), 'std': (39,),
}


def candidates(root):
    directory = Path(root) / 'training'
    paths = [directory / 'geometry-encoder-full-archive']
    paths.extend(sorted(directory.glob('remote-geometry-*')))
    selections = []
    for folder in paths:
        manifest = folder / 'training-manifest.json'
        model = folder / 'geometry-encoder-v1.npz'
        index = folder / 'source-embeddings-v1.npz'
        if not (manifest.is_file() and model.is_file() and index.is_file()):
            continue
        try:
            entry = json.loads(manifest.read_text())
            count = entry.get('trainingExamplesVerified')
            if (entry.get('schema') != 'exo.garmentcodedata-v2.geometry-training.v1'
                or entry.get('modelType') != 'self-supervised masked geometry feature encoder'
                or type(count) is not int or count < 1):
                continue
        except (OSError, ValueError, TypeError):
            continue
        selections.append((count, folder, entry))
    return sorted(selections, key=lambda row: (-row[0], str(row[1])))


def best(root, source_id=None):
    """Return verified selection and arrays; optionally require a particular source.

    Never fabricate an embedding for an unseen garment or use another source as
    a query. A larger but incomplete/corrupt checkpoint is skipped safely.
    """
    for count, folder, manifest in candidates(root):
        try:
            with np.load(folder / 'geometry-encoder-v1.npz', allow_pickle=False) as model:
                features = model['featureNames']
                if features.shape != (39,) or len(set(map(str, features))) != 39:
                    continue
                if any(model[key].shape != shape or not np.isfinite(model[key]).all()
                       for key, shape in MODEL_SHAPES.items()):
                    continue
                if not np.all(model['std'] > 0):
                    continue
            with np.load(folder / 'source-embeddings-v1.npz', allow_pickle=False) as archive:
                ids = np.asarray(archive['sourceIds'])
                vectors = np.asarray(archive['embeddings'], dtype=np.float32)
            if (ids.ndim != 1 or ids.shape != (count,)
                or vectors.shape != (count, 16) or not np.isfinite(vectors).all()
                or len(set(map(str, ids))) != count):
                continue
            if source_id is not None and not bool(np.any(ids == source_id)):
                continue
            return {'path': folder / 'source-embeddings-v1.npz',
                    'count': count, 'ids': ids, 'vectors': vectors,
                    'manifest': manifest, 'checkpointDirectory': folder.name}
        except (OSError, ValueError, TypeError, KeyError):
            continue
    return None
