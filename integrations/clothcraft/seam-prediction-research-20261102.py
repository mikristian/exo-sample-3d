#!/usr/bin/env python3
"""Bounded, read-only, learned seam-partner proposals for verified garments.

Version 1 ranks pairs of currently unpaired edges using the trained research
classifier. Existing source stitches are retained as immutable anchors.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import os
import re
import sqlite3
from pathlib import Path
import sys

os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')
import numpy as np

HERE = Path(__file__).resolve()
REPO = HERE.parents[2]
_tool_dirs = [
    REPO / 'download/garment-dxf-library-20261023/tools',
    Path(os.environ.get('EXO_GARMENTCODEDATA_V2_ROOT',
         str(Path.home() / 'Chat On Steroids Workspace/exo-clothcraft-v2/download/garment-dxf-library-20261023/garmentcodedata-v2'))).expanduser().parent / 'tools',
    Path.home() / 'Chat On Steroids Workspace/exo-clothcraft-v2/download/garment-dxf-library-20261023/tools',
]
TOOLS = next((candidate for candidate in _tool_dirs if (candidate / 'train_garmentcode_seams.py').is_file()), _tool_dirs[0])
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def archive_root():
    configured = os.getenv('EXO_GARMENTCODE_ARCHIVE_ROOT')
    candidates = ([Path(configured).expanduser()] if configured else []) + [
        REPO / 'download/garment-dxf-library-20261023/garmentcodedata-v2',
        Path.home() / 'Chat On Steroids Workspace/exo-clothcraft-v2/download/garment-dxf-library-20261023/garmentcodedata-v2',
    ]
    return next((p.resolve() for p in candidates if (p / 'pattern-index.sqlite3').is_file()), candidates[0].resolve())


def get_model(root, training_module):
    selected = root / 'training/best-seam-model.json'
    selection = json.loads(selected.read_text())
    if selection.get('schema') != 'exo.garmentcodedata-v2.seam-model-selection.v1' or int(selection.get('trainedGarments', 0)) < 100:
        raise ValueError('invalid_seam_model_selection')
    path = Path(selection['checkpoint']).expanduser()
    if not path.is_absolute():
        path = root / 'training' / path
    path = path.resolve()
    if not path.is_relative_to((root / 'training').resolve()) or path.name != 'seam-compatibility-v1.npz':
        raise ValueError('unsafe_seam_checkpoint_path')
    manifest = json.loads((path.parent / 'training-manifest.json').read_text())
    if manifest.get('schema') != 'exo.garmentcodedata-v2.seam-compatibility.v1' or manifest.get('numberOfFeatures') != len(training_module.FEATURE_NAMES):
        raise ValueError('invalid_seam_model_manifest')
    with np.load(path, allow_pickle=False) as arrays:
        required = ('w1', 'b1', 'w2', 'b2', 'mean', 'std', 'featureNames')
        if not all(k in arrays for k in required):
            raise ValueError('incomplete_seam_weights')
        model = {k: arrays[k].copy() for k in required}
    if model['w1'].shape != (33, 32) or model['b1'].shape != (32,) or model['w2'].shape != (32, 1) or model['b2'].shape != (1,) or model['mean'].shape != (33,) or model['std'].shape != (33,):
        raise ValueError('invalid_seam_weights_shape')
    if tuple(str(v) for v in model['featureNames']) != training_module.FEATURE_NAMES or not all(np.isfinite(model[k]).all() for k in required if k != 'featureNames') or np.any(model['std'] <= 0):
        raise ValueError('invalid_seam_weights_content')
    return model, {'path': str(path), 'trainedGarments': int(selection['trainedGarments']), 'checkpointSha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def key_of(side):
    return (side['panel'], int(side['edge']))


def pair_key(a, b):
    return tuple(sorted((a, b)))


def stitches_from_document(doc, records):
    anchors = set()
    for stitch in (doc.get('pattern') or {}).get('stitches') or []:
        try:
            # Dataset also encodes orientation as a third entry ('right_wrong').
            if not isinstance(stitch, list) or len(stitch) not in (2, 3):
                continue
            a, b = (key_of(s) for s in stitch[:2])
            if a != b and a in records and b in records:
                anchors.add(pair_key(a, b))
        except (TypeError, ValueError, KeyError):
            continue
    return anchors


def read_verified_source(root, source_id):
    if not isinstance(source_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,64}/\d{1,3}/[A-Za-z0-9_-]{1,120}', source_id):
        raise ValueError('invalid_source_id')
    body, batch, element = source_id.split('/')
    with sqlite3.connect('file:' + str(root / 'pattern-index.sqlite3') + '?mode=ro', uri=True) as db:
        row = db.execute('SELECT source_path,sha256,bytes FROM patterns WHERE body=? AND batch=? AND element=?',
                         (body, int(batch), element)).fetchone()
    if row is None:
        raise ValueError('source_not_indexed')
    relative, digest, size = row
    if not isinstance(relative, str) or Path(relative).is_absolute() or '..' in Path(relative).parts:
        raise ValueError('unsafe_source_path')
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()) or not path.is_file() or path.stat().st_size > 4 * 1024 * 1024:
        raise ValueError('source_not_local_or_too_large')
    raw = path.read_bytes()
    actual_hash = hashlib.sha256(raw).hexdigest()
    if actual_hash != digest or (size is not None and len(raw) != size):
        raise ValueError('source_integrity_failed')
    doc = json.loads(raw)
    if not isinstance(doc, dict) or not isinstance(doc.get('pattern'), dict):
        raise ValueError('invalid_source_specification')
    return doc, actual_hash


def edge_json(key):
    return {'panel': key[0], 'edge': key[1]}


def predict(doc, model, training_module, limit=20, max_edges=160, max_pairs=12800, anchors_enabled=True):
    records = training_module.collect_edge_records(doc)
    if len(records) > max_edges or len(records) < 2:
        raise ValueError('edge_count_outside_bound')
    anchors = stitches_from_document(doc, records)
    paired = {e for pair in anchors for e in pair} if anchors_enabled else set()
    available = sorted(set(records) - paired)
    if len(available) * (len(available) - 1) // 2 > max_pairs:
        raise ValueError('candidate_count_outside_bound')
    pairs = [pair_key(a, b) for i, a in enumerate(available) for b in available[i+1:]]
    if pairs:
        features = np.stack([training_module.pair_features(records[a], records[b]) for a, b in pairs])
        x = np.clip((features - model['mean']) / model['std'], -10, 10)
        hidden = np.tanh(x @ model['w1'] + model['b1'])
        score = 1 / (1 + np.exp(-np.clip((hidden @ model['w2'] + model['b2']).reshape(-1), -20, 20)))
        order = sorted(range(len(pairs)), key=lambda i: (-float(score[i]), pairs[i]))
    else:
        score = np.empty(0)
        order = []
    proposals = []
    graph = []
    graph_used = set()
    for rank, i in enumerate(order[:limit], start=1):
        a, b = pairs[i]
        la, lb = records[a]['length'], records[b]['length']
        mismatch = abs(la - lb) / max(la, lb)
        proposals.append({'rank': rank, 'a': edge_json(a), 'b': edge_json(b),
                          'score': round(float(score[i]), 6), 'scoreType': 'uncalibrated_classifier_output',
                          'chordLengthsCm': [round(la, 4), round(lb, 4)],
                          'relativeChordLengthMismatch': round(mismatch, 6),
                          'lengthWarning': mismatch > 0.05,
                          'status': 'predicted_unapproved_candidate'})
    # A simple disjoint matching is a proposed graph; every edge appears at
    # most once. Keep raw ranks separate for inspection of other alternatives.
    for i in order:
        a, b = pairs[i]
        if a in graph_used or b in graph_used:
            continue
        graph_used.update((a, b))
        graph.append({'a': edge_json(a), 'b': edge_json(b),
                      'score': round(float(score[i]), 6),
                      'relativeChordLengthMismatch': round(abs(records[a]['length'] - records[b]['length']) /
                                                            max(records[a]['length'], records[b]['length']), 6),
                      'status': 'predicted_unapproved_graph_edge'})
        if len(graph) >= limit:
            break
    return {'schema': 'exo.seam-prediction-research.v1', 'ok': True,
            'sourceAnchors': [[edge_json(a), edge_json(b)] for a, b in sorted(anchors)],
            'sourceAnchorsPreserved': True, 'anchorExclusionApplied': anchors_enabled,
            'eligibleUnpairedEdges': len(available), 'totalScoredPairs': len(pairs),
            'proposals': proposals, 'proposedDisjointGraph': graph,
            'warnings': ['Classifier scores are uncalibrated, not fit or manufacturing confidence.',
                         'Chord length checks omit curved arc length, ease, seam allowances, and sewability.',
                         'Proposed edges are not committed; physical fit, grading and factory approval require separate validation.']}


def evaluate(root, model, training_module, max_garments=20, max_edges=160):
    """Entire-garment test split, with all true stitches hidden during ranking."""
    db = sqlite3.connect('file:' + str(root / 'pattern-index.sqlite3') + '?mode=ro', uri=True)
    try:
        rows = db.execute("SELECT body,batch,element FROM patterns WHERE source_path IS NOT NULL ORDER BY body,batch,element")
        ids = []
        for body, batch, element in rows:
            digest = hashlib.sha256(str(element).encode()).digest()
            if int.from_bytes(digest[:4], 'big') % 10 == 9:
                ids.append(f'{body}/{int(batch):02d}/{element}')
                if len(ids) >= max_garments * 100:
                    break
    finally:
        db.close()
    eligible = 0
    total_edges = 0
    hits1 = hits5 = 0
    evaluated_positive_edges = 0
    false_top1 = 0
    unstitched_edge_predictions = 0
    skipped = {}
    for source_id in ids:
        if eligible >= max_garments:
            break
        try:
            doc, _ = read_verified_source(root, source_id)
            records = training_module.collect_edge_records(doc)
            anchors = stitches_from_document(doc, records)
            if not anchors or len(records) > max_edges:
                raise ValueError('no_usable_seams_or_too_many_edges')
            # Score every partner for each edge, including the actual sewn partner.
            keys = sorted(records)
            features = []
            pairs = []
            for i, a in enumerate(keys):
                for b in keys[i+1:]:
                    pairs.append((a, b))
                    features.append(training_module.pair_features(records[a], records[b]))
            if not pairs:
                continue
            x = np.clip((np.stack(features) - model['mean']) / model['std'], -10, 10)
            p = 1 / (1 + np.exp(-np.clip((np.tanh(x @ model['w1'] + model['b1']) @ model['w2'] + model['b2']).reshape(-1), -20, 20)))
            neighbors = {k: [] for k in keys}
            for (a, b), score in zip(pairs, p):
                neighbors[a].append((float(score), b))
                neighbors[b].append((float(score), a))
            truth = {k: set() for k in keys}
            for a, b in anchors:
                truth[a].add(b)
                truth[b].add(a)
            for edge, actual in truth.items():
                if not actual:
                    if neighbors[edge]:
                        unstitched_edge_predictions += 1
                    continue
                sorted_neighbors = [b for _, b in sorted(neighbors[edge], key=lambda item: (-item[0], item[1]))]
                evaluated_positive_edges += 1
                hits1 += bool(set(sorted_neighbors[:1]) & actual)
                hits5 += bool(set(sorted_neighbors[:5]) & actual)
                false_top1 += not bool(set(sorted_neighbors[:1]) & actual)
            total_edges += len(keys)
            eligible += 1
        except (ValueError, OSError, KeyError, TypeError, sqlite3.Error, json.JSONDecodeError) as exc:
            code = str(exc)[:80]
            skipped[code] = skipped.get(code, 0) + 1
    if not eligible:
        raise ValueError('no_locally_available_heldout_garments')
    return {'schema': 'exo.seam-prediction-evaluation.v1', 'split': 'SHA256(element) modulo 10 == 9; garment-disjoint test split',
            'garments': eligible, 'totalEdges': total_edges, 'stitchedAnchorEdgesEvaluated': evaluated_positive_edges,
            'top1PartnerRecall': round(hits1 / evaluated_positive_edges, 6),
            'top5PartnerRecall': round(hits5 / evaluated_positive_edges, 6),
            'top1FalsePartnerCount': false_top1,
            'top1FalsePartnerRate': round(false_top1 / evaluated_positive_edges, 6),
            'unstitchedEdgesWithTop1Candidate': unstitched_edge_predictions,
            'allEdgeTop1ReferencePrecision': round(hits1 / (evaluated_positive_edges + unstitched_edge_predictions), 6),
            'allEdgeTop1ReferenceFalsePositiveCount': false_top1 + unstitched_edge_predictions,
            'skipped': skipped,
            'interpretation': 'Offline ranking with all source stitches hidden. Unstitched edges are counted as false-positive references when the ranker proposes a partner; the source may omit sewable connections, so this does not prove a proposed seam physically impossible.'}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=archive_root())
    parser.add_argument('--source-id')
    parser.add_argument('--evaluate-heldout', action='store_true')
    parser.add_argument('--max-garments', type=int, default=20)
    parser.add_argument('--max-edges', type=int, default=160)
    parser.add_argument('--limit', type=int, default=20)
    args = parser.parse_args(argv)
    if (bool(args.source_id) == bool(args.evaluate_heldout)) or not 1 <= args.max_garments <= 100 or not 2 <= args.max_edges <= 160 or not 1 <= args.limit <= 100:
        parser.error('provide either --source-id or --evaluate-heldout with bounded positive limits')
    training = load_module('exo_seam_training', TOOLS / 'train_garmentcode_seams.py')
    root = args.root.resolve()
    model, provenance = get_model(root, training)
    if args.evaluate_heldout:
        answer = evaluate(root, model, training, args.max_garments, args.max_edges)
    else:
        doc, digest = read_verified_source(root, args.source_id)
        answer = predict(doc, model, training, limit=args.limit, max_edges=args.max_edges)
        answer.update(sourceId=args.source_id, sourceSha256=digest)
    answer['model'] = provenance
    print(json.dumps(answer, separators=(',', ':')))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, ImportError, KeyError, json.JSONDecodeError) as error:
        print(json.dumps({'ok': False, 'error': str(error)[:180]}))
        sys.exit(1)
