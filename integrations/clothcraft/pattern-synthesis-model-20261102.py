#!/usr/bin/env python3
"""Learned-neighbor-conditioned, topology-preserving source pattern proposals.

This module uses trained garment embeddings to choose an actual compatible donor.
Contours are interpolated explicitly; no neural contour decoder was trained.
The source seam graph is retained and scored by a separately trained classifier.
"""
import copy
import json
import math
import os
import re
import sys
from importlib.machinery import SourceFileLoader
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
geometry = SourceFileLoader('synthesis_geometry', str(HERE / 'pattern-source-geometry-20261102.py')).load_module()
ROOT = Path(os.environ.get('EXO_GARMENTCODEDATA_V2_ROOT') or geometry.archive.ROOT).expanduser().resolve()


def _seam_tools(root):
    candidates = [Path(root).parent / 'tools', HERE.parents[2] / 'download/garment-dxf-library-20261023/tools',
                  Path.home() / 'Chat On Steroids Workspace/exo-clothcraft-v2/download/garment-dxf-library-20261023/tools']
    for candidate in candidates:
        if (candidate / 'suggest_garmentcode_seams.py').is_file():
            return candidate
    raise ValueError('seam_model_inference_code_unavailable')


def _seam_checkpoint(root):
    selection = root / 'training/best-seam-model.json'
    if selection.is_file():
        data = json.loads(selection.read_text())
        checkpoint = data.get('checkpoint')
        if data.get('schema') != 'exo.garmentcodedata-v2.seam-model-selection.v1' or not isinstance(checkpoint, str):
            raise ValueError('invalid_seam_model_selection')
        candidate = Path(checkpoint)
        # Historical manifests contain machine-specific absolute paths. Resolve
        # their training subdirectory relative to this archive on other hosts.
        if candidate.is_absolute():
            parts = candidate.parts
            if 'training' not in parts:
                raise ValueError('unsafe_seam_checkpoint_path')
            candidate = Path(*parts[parts.index('training'):])
        resolved = (root / candidate).resolve()
        if not resolved.is_relative_to((root / 'training').resolve()) or resolved.name != 'seam-compatibility-v1.npz':
            raise ValueError('unsafe_seam_checkpoint_path')
        if not resolved.is_file():
            raise ValueError('selected_seam_checkpoint_unavailable')
        return resolved
    return root / 'training/seam-compatibility-v1/seam-compatibility-v1.npz'


def topology(panels):
    return tuple(sorted((name, len(p['vertices']),
                         tuple((tuple(e['endpoints']), (e.get('curvature') or {}).get('type'))
                               for e in p['edges'])) for name, p in panels.items()))


def graph_signature(pattern):
    return (topology(pattern['panels']),
            tuple(sorted(tuple(sorted((v['panel'], v['edge']) for v in seam))
                         for seam in pattern['stitches'])))


def propose(source_id, *, root=ROOT, embedding_path=None, seam_checkpoint=None,
            blend=0.15, search_limit=1000, donor_id=None):
    """Return explicit edit proposal; never claim EXO QA or physical fit success.

    `blend` must be in (0, 0.35]; donor is selected using learned cosine
    distance, then only panel contours are blended (same edge indices and graph).
    """
    if not isinstance(blend, (float, int)) or not math.isfinite(blend) or not 0 < blend <= 0.35:
        raise ValueError('blend_must_be_between_zero_and_0.35')
    root = Path(root).expanduser().resolve()
    if donor_id is not None and (not isinstance(donor_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,64}/\d{1,3}/[A-Za-z0-9_-]{1,120}', donor_id)):
        raise ValueError('invalid_donor_source_id')
    embedding_path = Path(embedding_path or root / 'training/geometry-encoder-full-archive/source-embeddings-v1.npz')
    seam_checkpoint = Path(seam_checkpoint or _seam_checkpoint(root))
    original = geometry.decode(source_id, root=root)
    base = original['spec']['pattern']
    signature = graph_signature(base)
    with np.load(embedding_path, allow_pickle=False) as checkpoint:
        ids = checkpoint['sourceIds']
        vectors = np.asarray(checkpoint['embeddings'], dtype=np.float32)
    manifest = json.loads(embedding_path.with_name('training-manifest.json').read_text())
    trained_count = manifest.get('trainingExamplesVerified')
    if (type(trained_count) is not int or trained_count < 1 or vectors.ndim != 2
            or vectors.shape != (trained_count, 16) or len(ids) != trained_count
            or len(set(ids.tolist())) != trained_count or not np.isfinite(vectors).all()):
        raise ValueError('invalid_learned_embedding_checkpoint')
    source_indices = np.flatnonzero(ids == source_id)
    if len(source_indices) != 1:
        raise ValueError('source_missing_from_trained_embedding_index')
    unit = vectors / np.maximum(np.linalg.norm(vectors, axis=1, keepdims=True), 1e-12)
    cosine = unit @ unit[int(source_indices[0])]
    ranked = np.argsort(-cosine, kind='stable')
    selected = None
    for rank, idx in enumerate(ranked):
        candidate_id = str(ids[idx])
        if donor_id is None and rank > search_limit:
            break
        if candidate_id == source_id or (donor_id is not None and candidate_id != donor_id):
            continue
        try:
            candidate = geometry.decode(candidate_id, root=root)
        except (geometry.DecodeError, OSError, ValueError):
            continue
        if graph_signature(candidate['spec']['pattern']) == signature:
            selected = (candidate_id, candidate, float(cosine[idx]))
            break
    if selected is None:
        raise ValueError('no_compatible_verified_neighbor_in_search_window')
    chosen_id, donor, similarity = selected
    modified = copy.deepcopy(original['spec'])
    changed = 0
    for name, panel in modified['pattern']['panels'].items():
        a = np.asarray(panel['vertices'], dtype=np.float64)
        b = np.asarray(donor['spec']['pattern']['panels'][name]['vertices'], dtype=np.float64)
        # Translate donor to the source centroid, preserving intended panel placement.
        next_vertices = a + float(blend) * (b - b.mean(axis=0) + a.mean(axis=0) - a)
        if not np.isfinite(next_vertices).all():
            raise ValueError('invalid_blended_geometry')
        changed += int(np.max(np.abs(next_vertices - a)) > 1e-6)
        panel['vertices'] = next_vertices.tolist()
        for edge_index, edge in enumerate(panel['edges']):
            curve = edge.get('curvature')
            if curve is None:
                continue
            donor_curve = donor['spec']['pattern']['panels'][name]['edges'][edge_index]['curvature']
            if curve['type'] in ('quadratic', 'cubic'):
                # Relative control locations are blended in the same edge frame.
                ca = np.asarray(curve['params'], dtype=np.float64)
                cb = np.asarray(donor_curve['params'], dtype=np.float64)
                curve['params'] = ((1-blend)*ca + blend*cb).tolist()
            elif curve['params'] != donor_curve['params']:
                # Source circle parameter semantics differ; unsafe to blend.
                raise ValueError('incompatible_circle_curves')
    if not changed:
        raise ValueError('neighbor_produced_no_geometric_change')
    learned_seams = []
    tools_dir = _seam_tools(root)
    if str(tools_dir) not in sys.path:
        sys.path.insert(0, str(tools_dir))
    from suggest_garmentcode_seams import load_model, rank_matches
    model = load_model(seam_checkpoint)
    for seam in modified['pattern']['stitches']:
        anchor, partner = seam
        ranked_partners = rank_matches(modified, anchor['panel'], anchor['edge'], model, top_k=10000)
        matching = next((item for item in ranked_partners if item['panel'] == partner['panel']
                         and item['edge'] == partner['edge']), None)
        learned_seams.append({'sourceSeam': seam, 'rankingScore': matching['rankingScore'] if matching else None})
    return {'ok': True, 'candidateType': 'learned-neighbor-conditioned-contour-interpolation',
            'sourceId': source_id, 'donorSourceId': chosen_id, 'embeddingCosineSimilarity': round(similarity, 6),
            'blend': float(blend), 'changedPanels': changed, 'spec': modified,
            'seamModelAssessments': learned_seams, 'sourceSha256': original['sourceSha256'],
            'donorSha256': donor['sourceSha256'], 'verifiedSourceInputs': True,
            'geometryTrainingExamplesVerified': trained_count,
            'seamCheckpoint': str(seam_checkpoint),
            'trainedContourDecoder': False, 'newlyPredictedSeamGraph': False,
            'exoQaPassed': False, 'editableCandidateReady': False,
            'gradingValidated': False, 'fitValidated': False, 'factoryApproved': False,
            'warnings': ['Source geometry and seams are research inputs; interpolated contour has not passed EXO physical seam-length QA.',
                         'The trained encoder chooses a donor; geometric interpolation is deterministic, not neural generation.',
                         'Existing seams are scored by a trained classifier and preserved, not automatically restitched.']}


if __name__ == '__main__':
    try:
        request = json.loads(sys.stdin.read() or '{}')
        print(json.dumps(propose(request['sourceId'], blend=request.get('blend', 0.15),
                                 search_limit=request.get('searchLimit', 1000), donor_id=request.get('donorSourceId'))))
    except (KeyError, TypeError, ValueError, OSError, geometry.DecodeError) as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}))
