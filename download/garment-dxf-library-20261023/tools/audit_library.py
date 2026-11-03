#!/usr/bin/env python3
"""Read-only integrity/provenance audit of the additive DXF research library.

Does not interpret industrial grading, seam semantics, or factory approval.
"""
from __future__ import annotations

from collections import Counter
from pathlib import Path
import csv
import hashlib
import json
import sys


ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / 'reports'
SOURCES = (
    ('upstream_research_fixtures', 'astm-parser-files.json'),
    ('github_original_references', 'github-source-files.json'),
    ('github_derived_garmentcode', 'garmentcode-derived-files.json'),
    ('generated_basic_blocks', 'synthetic-pattern-files.json'),
    ('generated_complete_garments', 'synthetic-garment-files.json'),
)
OPENPATTERN_MANIFEST = REPORTS / 'openpattern-files.json'


def inspect(data):
    if data.startswith(b'AutoCAD Binary DXF'):
        return {'envelopeOK': True, 'format': 'BINARY_DXF',
                'geometryEntityTags': None, 'needsFullParser': True}
    lines = data.decode('latin-1').replace('\r\n', '\n').splitlines()
    code_pairs = list(zip(lines[::2], lines[1::2]))
    tags = Counter(value.strip().upper() for code, value in code_pairs if code.strip() == '0')
    valid = (tags['SECTION'] >= 1 and tags['ENDSEC'] >= 1 and tags['EOF'] >= 1
             and ('ENTITIES' in data.decode('latin-1')))
    geometry = sum(tags[tag] for tag in ('LINE', 'LWPOLYLINE', 'POLYLINE',
                                        'SPLINE', 'ARC', 'CIRCLE', 'POINT', 'VERTEX',
                                        'INSERT', 'ELLIPSE', '3DFACE'))
    return {'envelopeOK': bool(valid and geometry), 'format': 'ASCII_DXF',
            'geometryEntityTags': geometry, 'needsFullParser': True}


def main():
    records, problems = [], []
    inputs = list(SOURCES)
    if OPENPATTERN_MANIFEST.exists():
        inputs.append(('openpattern_local_imports', OPENPATTERN_MANIFEST.name))
    for collection, filename in inputs:
        file = REPORTS / filename
        entries = json.loads(file.read_text(encoding='utf-8'))
        if not isinstance(entries, list):
            problems.append({'filename': filename, 'problem': 'invalid manifest'})
            continue
        for entry in entries:
            if collection == 'openpattern_local_imports' and not all(
                    isinstance(entry, dict) and entry.get(key) for key in
                    ('filename', 'source', 'sha256', 'license', 'attribution')):
                problems.append({'filename': filename, 'problem': 'OpenPattern provenance or license missing'})
                continue
            relative = entry['filename']
            path = ROOT / relative
            if not path.resolve().is_relative_to(ROOT.resolve()):
                problems.append({'filename': relative, 'problem': 'path escapes library'})
                continue
            if collection == 'openpattern_local_imports' and not path.resolve().is_relative_to((ROOT / 'dxf' / 'openpattern-imports').resolve()):
                problems.append({'filename': relative, 'problem': 'OpenPattern file outside import directory'})
                continue
            if not path.is_file():
                problems.append({'filename': relative, 'problem': 'missing file'})
                continue
            data = path.read_bytes()
            hash_value = hashlib.sha256(data).hexdigest()
            info = inspect(data)
            row = {'filename': relative, 'collection': collection,
                   'source': entry['source'], 'sha256': hash_value,
                   'bytes': len(data), 'factoryApproved': False,
                   'licenseStatus': entry.get('license', 'review required'), **info}
            if collection in ('openpattern_local_imports', 'github_original_references'):
                row['attribution'] = entry['attribution']
                row['originalName'] = entry.get('originalName')
                row['upstreamPath'] = entry.get('upstreamPath')
            if collection == 'github_derived_garmentcode':
                row['attribution'] = entry['attribution']
                row['sourceJsonSha256'] = entry['sourceJsonSha256']
                row['upstreamPath'] = entry['upstreamPath']
                row['group'] = entry['group']
                row['derivation'] = entry['derivation']
            records.append(row)
            if hash_value != entry['sha256']:
                problems.append({'filename': relative, 'problem': 'hash mismatch'})
            if not info['envelopeOK']:
                problems.append({'filename': relative, 'problem': 'invalid DXF envelope or empty geometry'})

    seen = set()
    for row in records:
        if row['sha256'] in seen:
            problems.append({'filename': row['filename'], 'problem': 'duplicate content SHA-256'})
        seen.add(row['sha256'])

    result = {
        'schema': 'exo.reference-dxf-library.v1',
        'verifiedFileCount': len(records),
        'uniqueSha256Count': len(seen),
        'byteCount': sum(row['bytes'] for row in records),
        'collections': dict(Counter(row['collection'] for row in records)),
        'checks': 'sha256, ASCII/binary DXF envelope and basic geometry-entity presence',
        'factoryCertified': False,
        'thirdPartyFixtureLicensesApprovedForTraining': False,
        'knownMissing': 'Recipient CAD checks, AAMA/ASTM conformance, grading fidelity and sewn samples',
        'errors': problems,
        'files': records,
    }
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / 'library-catalog.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    with (REPORTS / 'library-catalog.csv').open('w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['filename', 'collection', 'source', 'bytes', 'sha256', 'format',
                                               'geometryEntityTags', 'envelopeOK', 'licenseStatus'])
        writer.writeheader()
        for row in records:
            writer.writerow({k: row[k] for k in writer.fieldnames})
    print(json.dumps({k: v for k, v in result.items() if k != 'files'}, indent=2))
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
