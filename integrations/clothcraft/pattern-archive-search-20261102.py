"""Read-only, provenance-preserving search of the local GarmentCodeData archive."""
import json
import os
import sqlite3
import sys
from pathlib import Path

def archive_root():
    """Keep the large, user-owned index outside the signed native application."""
    relative = Path('download/garment-dxf-library-20261023/garmentcodedata-v2')
    candidates = []
    configured = os.environ.get('EXO_GARMENTCODE_ARCHIVE_ROOT')
    if configured:
        candidates.append(Path(configured).expanduser())
    candidates.extend([
        Path(__file__).resolve().parents[2] / relative,
        Path.home() / 'Chat On Steroids Workspace/exo-clothcraft-v2' / relative,
    ])
    return next((candidate for candidate in candidates if (candidate / 'pattern-index.sqlite3').is_file()), candidates[0])


ROOT = archive_root()
DB = ROOT / 'pattern-index.sqlite3'
FIELDS = 'body,batch,element,sha256,bytes,panel_count,source_path,dxf_path,dxf_sha256,source,license,attribution,factory_approved'


def nearest(options):
    """Compare a known archive source's trained geometry embedding to other sources."""
    if not DB.is_file():
        return {'ok': False, 'error': 'archive_index_unavailable', 'results': []}
    source_id = options.get('sourceId')
    if not isinstance(source_id, str) or len(source_id) > 200 or not source_id:
        return {'ok': False, 'error': 'invalid_source_id', 'results': []}
    try:
        limit = int(options.get('limit', 10))
    except (TypeError, ValueError):
        return {'ok': False, 'error': 'invalid_limit', 'results': []}
    if not 1 <= limit <= 30:
        return {'ok': False, 'error': 'invalid_limit', 'results': []}
    directory = ROOT / 'training/geometry-encoder-full-archive'
    embeddings_path = directory / 'source-embeddings-v1.npz'
    checkpoint_path = directory / 'geometry-encoder-v1.npz'
    manifest_path = directory / 'training-manifest.json'
    if not all(p.is_file() for p in (embeddings_path, checkpoint_path, manifest_path)):
        return {'ok': False, 'error': 'geometry_embeddings_unavailable', 'results': []}
    try:
        import numpy as np
    except ImportError:
        return {'ok': False, 'error': 'numpy_unavailable', 'results': []}
    with np.load(embeddings_path, allow_pickle=False) as arrays:
        ids = arrays['sourceIds']
        vectors = arrays['embeddings']
    if vectors.ndim != 2 or vectors.shape[1] != 16 or len(ids) != len(vectors) or not np.isfinite(vectors).all():
        return {'ok': False, 'error': 'invalid_geometry_embeddings', 'results': []}
    # Exact source identity; no prompt encoding, approximation, or fallback query vector.
    matches = np.flatnonzero(ids == source_id)
    if len(matches) != 1:
        return {'ok': False, 'error': 'source_embedding_unavailable', 'results': []}
    norms = np.linalg.norm(vectors, axis=1)
    index = int(matches[0])
    if norms[index] <= 0:
        return {'ok': False, 'error': 'invalid_geometry_embeddings', 'results': []}
    scores = (vectors @ vectors[index]) / np.maximum(norms * norms[index], 1e-12)
    scores[index] = -np.inf
    indices = np.argsort(-scores, kind='stable')[:limit]
    db = sqlite3.connect('file:' + str(DB) + '?mode=ro', uri=True, timeout=3)
    db.row_factory = sqlite3.Row
    try:
        results = []
        for i in indices:
            candidate = str(ids[i])
            parts = candidate.split('/')
            if len(parts) != 3 or not parts[1].isdigit():
                continue
            record = db.execute('SELECT ' + FIELDS + ' FROM patterns WHERE body=? AND batch=? AND element=?',
                                (parts[0], int(parts[1]), parts[2])).fetchone()
            if record is None:
                continue
            item = dict(record)
            item['sourceId'] = candidate
            item['similarity'] = float(scores[i])
            item['factoryApproved'] = bool(item.pop('factory_approved'))
            item['specificationLocallyAvailable'] = (ROOT / item['source_path']).is_file()
            item['dxfLocallyAvailable'] = bool(item['dxf_path'] and (ROOT / item['dxf_path']).is_file())
            results.append(item)
        manifest = json.loads(manifest_path.read_text())
        return {'ok': True, 'sourceId': source_id, 'results': results,
                'embeddingCount': len(ids), 'embeddingDimensions': vectors.shape[1],
                'similarityMetric': 'cosine', 'searchMode': 'learned_geometry_embedding_nearest_source',
                'modelType': manifest.get('modelType', 'geometry encoder'),
                'sourceDOI': manifest.get('sourceDOI'),
                'limitations': 'Cosine similarity is not a fit score, calibrated confidence, new pattern generation, or manufacturing approval. Requires an existing encoded sourceId; only source patterns in the saved embedding checkpoint can be queried.'}
    finally:
        db.close()


def search(options):
    if not DB.is_file():
        return {'ok': False, 'error': 'archive_index_unavailable', 'results': []}
    limit = min(50, max(1, int(options.get('limit', 12))))
    offset = min(1000000, max(0, int(options.get('offset', 0))))
    query = str(options.get('query') or '').strip()[:120]
    source_id = str(options.get('sourceId') or '').strip()[:200]
    body = str(options.get('body') or '').strip()[:40]
    min_panels = options.get('minPanels')
    max_panels = options.get('maxPanels')
    args = []
    clauses = []
    if source_id:
        parts = source_id.split('/')
        if len(parts) != 3 or not parts[1].isdigit():
            return {'ok': False, 'error': 'invalid_source_id', 'results': []}
        clauses += ['body = ?', 'batch = ?', 'element = ?']
        args += [parts[0], int(parts[1]), parts[2]]
    if body:
        clauses.append('body = ?')
        args.append(body)
    if query:
        # Escaped substring matching only; does not infer a clothing category from arbitrary IDs.
        escaped = query.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
        clauses.append("(element LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')")
        args += ['%' + escaped + '%'] * 2
    for value, operator in ((min_panels, '>='), (max_panels, '<=')):
        if value is not None:
            n = int(value)
            if n < 0 or n > 1000:
                return {'ok': False, 'error': 'invalid_panel_count', 'results': []}
            clauses.append('panel_count ' + operator + ' ?')
            args.append(n)
    where = (' WHERE ' + ' AND '.join(clauses)) if clauses else ''
    db = sqlite3.connect('file:' + str(DB) + '?mode=ro', uri=True, timeout=3)
    db.row_factory = sqlite3.Row
    try:
        total = db.execute('SELECT count(*) FROM patterns' + where, args).fetchone()[0]
        indexed = db.execute('SELECT count(*), sum(CASE WHEN dxf_path IS NOT NULL THEN 1 ELSE 0 END) FROM patterns').fetchone()
        rows = db.execute('SELECT ' + FIELDS + ' FROM patterns' + where +
                          ' ORDER BY body,batch,element LIMIT ? OFFSET ?', args + [limit, offset]).fetchall()
        results = []
        for row in rows:
            item = dict(row)
            item['sourceId'] = f"{item['body']}/{item['batch']:02d}/{item['element']}"
            item['factoryApproved'] = bool(item.pop('factory_approved'))
            item['specificationLocallyAvailable'] = (ROOT / item['source_path']).is_file()
            item['dxfLocallyAvailable'] = bool(item['dxf_path'] and (ROOT / item['dxf_path']).is_file())
            item['hasRecordedDxfPath'] = bool(item['dxf_path'])
            results.append(item)
        return {'ok': True, 'results': results, 'matched': total, 'limit': limit, 'offset': offset,
                'coverage': {'indexed': indexed[0], 'recordedDxfPaths': indexed[1] or 0,
                             'geometryEmbeddings': 50036 if (ROOT / 'training/geometry-encoder-full-archive/source-embeddings-v1.npz').is_file() else 0},
                'searchMode': 'source_id_or_literal_tag',
                'limitations': 'Catalog entries are not factory-approved patterns. Many source specifications reside in archives, and most entries have no DXF path. Text queries match recorded body/element IDs only.'}
    finally:
        db.close()


if __name__ == '__main__':
    try:
        payload = json.loads(sys.stdin.read() or '{}')
        print(json.dumps(nearest(payload) if payload.get('mode') == 'nearest' else search(payload)))
    except (ValueError, TypeError, sqlite3.Error) as exc:
        print(json.dumps({'ok': False, 'error': 'invalid_request_or_index', 'detail': str(exc), 'results': []}))
