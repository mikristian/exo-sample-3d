#!/usr/bin/env python3
"""Read-only EXO V2 desktop bundle/source hash coverage audit.

Never publishes application bytes, paths, signed binaries, user projects or media.
This checks a source snapshot against the installed runtime-provenance ledger;
source-code parity is distinct from reproducible binaries and a verified GUI.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def invoke(*args: str) -> bytes:
    return subprocess.check_output(['git', '-C', str(ROOT), *args], stderr=subprocess.DEVNULL)


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for part in iter(lambda: f.read(1024 * 1024), b''):
            h.update(part)
    return h.hexdigest()


def public_safe_path(path: str) -> bool:
    low = path.lower()
    return not any(term in low for term in (
        'private', 'clo-thomas', 'clo-hardware', '.env', 'credentials',
        'token', 'secret', 'key-store', '/models/', '/avatars/',
        '/output/', 'user-data', 'license.dat',
    ))


def audit(app: Path, ref: str) -> dict:
    resources = app / 'Contents' / 'Resources'
    source_map_file = resources / 'runtime-provenance.json'
    if not (app / 'Contents' / 'MacOS' / 'EXOClothCraft').is_file():
        raise ValueError('The selected app does not contain the EXOClothCraft executable')
    provenance = json.loads(source_map_file.read_text())
    if provenance.get('schema') != 'exo.desktop.runtime-provenance.v3':
        raise ValueError('Unexpected runtime-provenance schema')
    commit = invoke('rev-parse', '--verify', f'{ref}^{{commit}}').decode().strip()
    paths = set(invoke('ls-tree', '-r', '--name-only', '-z', commit).decode().split('\0'))
    counts = collections.Counter()
    public_diffs = []
    missing_public = []
    for rel, meta in provenance['files'].items():
        rel_path = Path(rel)
        if rel_path.is_absolute() or '..' in rel_path.parts:
            counts['unsafe_provenance_path'] += 1
            continue
        installed = resources / rel_path
        if not installed.is_file():
            counts['missing_bundled_resource'] += 1
            continue
        observed = file_sha256(installed)
        if observed != meta.get('sha256'):
            counts['runtime_hash_mismatch'] += 1
        else:
            counts['runtime_hash_verified'] += 1
        if rel.startswith('web/'):
            counts['web_build_or_asset'] += 1
            continue
        if rel.startswith(('bin/', 'node_modules/')) or '/target/' in rel or '/build-cmake/' in rel:
            counts['compiled_or_third_party_runtime'] += 1
            continue
        if not public_safe_path(rel):
            counts['restricted_or_local_resource'] += 1
            continue
        if rel in paths:
            published = invoke('show', f'{commit}:{rel}')
            if hashlib.sha256(published).hexdigest() == observed:
                counts['exact_tracked_source'] += 1
            else:
                historical = 'source-snapshots/exo-v2-installed-20261103/' + rel
                if historical in paths and hashlib.sha256(invoke('show', f'{commit}:{historical}')).hexdigest() == observed:
                    counts['exact_versioned_source_snapshot'] += 1
                else:
                    counts['changed_tracked_source'] += 1
                    public_diffs.append(rel)
        else:
            counts['no_same_path_source_in_git'] += 1
            missing_public.append(rel)
    observed_total = len(provenance['files'])
    assert sum(counts[k] for k in ('runtime_hash_verified','runtime_hash_mismatch','missing_bundled_resource','unsafe_provenance_path')) == observed_total
    source_match = counts['exact_tracked_source'] + counts['exact_versioned_source_snapshot']
    return {
        'schema':'exo.public-source-parity-audit.v1',
        'installed_runtime_schema':provenance['schema'],
        'installed_runtime_built_at':provenance.get('builtAt'),
        'published_source_commit':commit,
        'installed_manifest_entries':observed_total,
        'counts':dict(sorted(counts.items())),
        'source_exact_for_all_resources':False,
        'verified_exact_source_paths_including_versioned_snapshots':source_match,
        'source_differing_paths':sorted(public_diffs),
        'source_missing_public_paths':sorted(missing_public),
        'qualification':(
            'A runtime bundle hash verifies its installed bytes, not corresponding ' 
            'source reproducibility. web assets, binary runtimes and licensed local ' 
            'media need separate build provenance, release gates and clean-install QA.'
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app',type=Path,default=Path.home()/'Applications/EXO ClothCraft Studio V2.app')
    parser.add_argument('--ref',default='HEAD')
    parser.add_argument('--out',type=Path)
    args=parser.parse_args()
    result=audit(args.app,args.ref)
    payload=json.dumps(result,indent=2,sort_keys=True)+'\n'
    if args.out:args.out.write_text(payload)
    print(payload,end='')


if __name__=='__main__':
    main()
