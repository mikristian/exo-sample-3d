"""Strict source-backed GarmentCodeData v2 geometry reader (no generated contours)."""
import hashlib
import json
import math
import os
import re
import sqlite3
import sys
from pathlib import Path

from importlib.machinery import SourceFileLoader

archive = SourceFileLoader('exo_archive', str(Path(__file__).with_name('pattern-archive-search-20261102.py'))).load_module()


class DecodeError(Exception):
    pass


def require(condition, code):
    if not condition:
        raise DecodeError(code)


def number(value):
    require(type(value) in (int, float) and math.isfinite(value) and abs(value) < 1000000, 'invalid_numeric_geometry')
    return value


def vector(value, n):
    require(isinstance(value, list) and len(value) == n, 'invalid_vector')
    return [number(v) for v in value]


def decode(source_id, root=None):
    root = Path(root or archive.ROOT).resolve()
    require(isinstance(source_id, str) and re.fullmatch(r'[A-Za-z0-9_-]{1,64}/\d{1,3}/[A-Za-z0-9_-]{1,120}', source_id), 'invalid_source_id')
    require((root / 'pattern-index.sqlite3').is_file(), 'archive_index_unavailable')
    body, batch, element = source_id.split('/')
    with sqlite3.connect('file:' + str(root / 'pattern-index.sqlite3') + '?mode=ro', uri=True) as db:
        record = db.execute('SELECT source_path,sha256,bytes,license,attribution,source FROM patterns WHERE body=? AND batch=? AND element=?', (body, int(batch), element)).fetchone()
    require(record is not None, 'source_not_indexed')
    rel, expected_hash, expected_bytes, license_name, attribution, source = record
    require(isinstance(rel, str) and not Path(rel).is_absolute() and '..' not in Path(rel).parts, 'unsafe_source_path')
    file = (root / rel).resolve()
    require(file.is_relative_to(root), 'unsafe_source_path')
    require(file.is_file(), 'source_specification_not_local')
    require(file.stat().st_size <= 4 * 1024 * 1024, 'source_specification_too_large')
    raw = file.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    require(isinstance(expected_hash, str) and digest == expected_hash.lower(), 'source_hash_mismatch')
    require(expected_bytes is None or len(raw) == expected_bytes, 'source_size_mismatch')
    spec = json.loads(raw)
    props = spec.get('properties', {})
    require(isinstance(props, dict) and props.get('units_in_meter') == 100, 'unsupported_units')
    require(props.get('curvature_coords') == 'relative' and props.get('normalized_edge_loops') is True, 'unsupported_geometry_convention')
    pattern = spec.get('pattern', {})
    source_panels = pattern.get('panels')
    require(isinstance(source_panels, dict) and 0 < len(source_panels) <= 128, 'invalid_panels')
    panels = []
    edge_counts = {}
    for name, p in source_panels.items():
        require(isinstance(name, str) and re.fullmatch(r'[A-Za-z0-9_-]{1,100}', name) and isinstance(p, dict), 'invalid_panel')
        vertices = p.get('vertices')
        edges = p.get('edges')
        require(isinstance(vertices, list) and 3 <= len(vertices) <= 1000 and isinstance(edges, list) and len(edges) == len(vertices), 'invalid_panel_topology')
        vertices = [vector(v, 2) for v in vertices]
        normalized_edges = []
        adjacency = [set() for _ in vertices]
        edge_pairs = set()
        for index, edge in enumerate(edges):
            require(isinstance(edge, dict), 'invalid_edge')
            endpoints = edge.get('endpoints')
            require(isinstance(endpoints, list) and len(endpoints) == 2 and all(type(v) is int and 0 <= v < len(vertices) for v in endpoints) and endpoints[0] != endpoints[1], 'invalid_edge_endpoints')
            pair = frozenset(endpoints)
            require(pair not in edge_pairs, 'duplicate_edge')
            edge_pairs.add(pair)
            adjacency[endpoints[0]].add(endpoints[1])
            adjacency[endpoints[1]].add(endpoints[0])
            require(vertices[endpoints[0]] != vertices[endpoints[1]], 'zero_length_edge')
            normalized = {'endpoints': endpoints}
            if 'label' in edge:
                require(isinstance(edge['label'], str) and len(edge['label']) <= 120, 'invalid_edge_label')
                normalized['label'] = edge['label']
            if 'curvature' in edge:
                curve = edge['curvature']
                require(isinstance(curve, dict) and curve.get('type') in ('quadratic', 'cubic', 'circle'), 'unsupported_curve')
                params = curve.get('params')
                if curve['type'] == 'quadratic':
                    require(isinstance(params, list) and len(params) == 1, 'unsupported_curve')
                    params = [vector(params[0], 2)]
                elif curve['type'] == 'cubic':
                    require(isinstance(params, list) and len(params) == 2, 'unsupported_curve')
                    params = [vector(v, 2) for v in params]
                else:
                    require(isinstance(params, list) and len(params) == 3, 'unsupported_curve')
                    params = [number(v) for v in params]
                    require(params[0] > 0 and params[2] in (0, 1), 'unsupported_curve')
                normalized['curvature'] = {'type': curve['type'], 'params': params, 'coordinates': 'relative'}
            normalized_edges.append(normalized)
        require(all(len(neighbors) == 2 for neighbors in adjacency), 'unsupported_edge_topology')
        reached = {0}
        pending = [0]
        while pending:
            for neighbor in adjacency[pending.pop()]:
                if neighbor not in reached:
                    reached.add(neighbor)
                    pending.append(neighbor)
        require(len(reached) == len(vertices), 'unsupported_edge_topology')
        edge_counts[name] = len(normalized_edges)
        panels.append({'id': name, 'label': p.get('label') if isinstance(p.get('label'), str) else '', 'vertices': vertices,
                       'edges': normalized_edges, 'translation': vector(p.get('translation', [0, 0, 0]), 3),
                       'rotation': vector(p.get('rotation', [0, 0, 0]), 3)})
    seams = pattern.get('stitches', [])
    require(isinstance(seams, list) and len(seams) <= 4096, 'invalid_seams')
    normalized_seams = []
    for seam in seams:
        require(isinstance(seam, list) and len(seam) == 2, 'unsupported_seam_relationship')
        pair = []
        for side in seam:
            require(isinstance(side, dict) and side.get('panel') in edge_counts and type(side.get('edge')) is int and 0 <= side['edge'] < edge_counts[side['panel']], 'invalid_seam_reference')
            pair.append({'panel': side['panel'], 'edge': side['edge']})
        require(pair[0] != pair[1], 'invalid_seam_reference')
        normalized_seams.append(pair)
    normalized_pattern = {'panels': {panel['id']: {'label': panel['label'], 'vertices': panel['vertices'],
                           'edges': panel['edges'], 'translation': panel['translation'], 'rotation': panel['rotation']} for panel in panels},
                          'stitches': normalized_seams}
    return {'ok': True, 'verified': True, 'sourceId': source_id,
            'spec': {'pattern': normalized_pattern, 'properties': props},
            'units': 'cm', 'sourceSha256': digest,
            'source': {'dataset': 'GarmentCodeData v2', 'sourceId': source_id, 'license': license_name,
                       'sha256': digest, 'origin': source, 'attribution': attribution},
            'license': license_name, 'attribution': attribution,
            'panels': panels, 'seams': normalized_seams, 'parameters': spec.get('parameters', {}),
            'parameterOrder': spec.get('parameter_order', []), 'properties': props,
            'warnings': ['This is verified raw source geometry, not an EXO-QA-passed editable candidate.',
                         'Source edge indices are preserved for stitch references; editors must retain this mapping.',
                         'Curves retain source-relative semantics; editor must support them exactly before modification or export.',
                         'Physical seam lengths may mismatch; EXO seam QA, grading, body fit and manufacturing suitability have not passed validation.'],
            'exoQaPassed': False, 'editableCandidateReady': False,
            'factoryApproved': False, 'gradingValidated': False, 'fitValidated': False}


if __name__ == '__main__':
    try:
        request = json.loads(sys.stdin.read() or '{}')
        print(json.dumps(decode(request.get('sourceId'))))
    except (DecodeError, ValueError, TypeError, OSError, sqlite3.Error, json.JSONDecodeError) as exc:
        print(json.dumps({'ok': False, 'error': str(exc) if isinstance(exc, DecodeError) else 'source_decode_failed'}))
