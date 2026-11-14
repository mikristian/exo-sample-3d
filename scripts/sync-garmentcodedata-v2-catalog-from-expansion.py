#!/usr/bin/env python3
"""Safely restore EXO's local pattern catalog from its ExpansionCloud snapshot.

Only reads a completed compressed SQLite backup published by the expansion Mac.
WebDAV databases are never opened directly: decompress locally, verify database
integrity, then use SQLite's transactional backup protocol to update EXO.
"""
from __future__ import annotations

import argparse
import gzip
import json
import sqlite3
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LOCAL = ROOT / 'download/garment-dxf-library-20261023/garmentcodedata-v2/pattern-index.sqlite3'
DEFAULT_CLOUD = Path.home() / 'ExpansionCloud/EXO-ClothCraft/GarmentCodeData-v2/metadata/pattern-index.sqlite3.gz'


def counts(connection):
    return {
        'specifications': connection.execute('SELECT COUNT(*) FROM patterns').fetchone()[0],
        'completedBatches': connection.execute('SELECT COUNT(*) FROM processed_batches').fetchone()[0],
        'archivedBatches': connection.execute('SELECT COUNT(*) FROM archived_batches').fetchone()[0],
    }


def sync(cloud, local, dry_run=False):
    if not cloud.is_file():
        raise FileNotFoundError('ExpansionCloud metadata backup is missing or unavailable')
    local.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=local.parent, prefix='.expansion-catalog-') as tmp:
        extracted = Path(tmp)/'remote-index.sqlite3'
        with gzip.open(cloud, 'rb') as source, extracted.open('wb') as target:
            for block in iter(lambda: source.read(1024*1024), b''):
                target.write(block)
        # Temporary path may contain spaces; plain-path SQLite avoids URI
        # escaping mistakes while query_only prevents modifying the snapshot.
        remote = sqlite3.connect(str(extracted), timeout=30)
        try:
            remote.execute('PRAGMA query_only=ON')
            if remote.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise ValueError('ExpansionCloud SQLite backup failed integrity_check')
            updated = counts(remote)
            existing = {'specifications':0, 'completedBatches':0, 'archivedBatches':0}
            if local.exists():
                previous = sqlite3.connect(local, timeout=30)
                try: existing = counts(previous)
                finally: previous.close()
            if any(updated[key] < existing[key] for key in existing):
                raise ValueError('Remote backup is older than the current local index; refusing downgrade')
            result = {'before':existing, 'after':updated, 'applied':not dry_run}
            if not dry_run:
                destination = sqlite3.connect(local, timeout=30)
                try:
                    remote.backup(destination)
                    if destination.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                        raise ValueError('Restored local SQLite failed integrity_check')
                    destination.commit()
                finally:
                    destination.close()
            return result
        finally:
            remote.close()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cloud', type=Path, default=DEFAULT_CLOUD)
    p.add_argument('--local', type=Path, default=DEFAULT_LOCAL)
    p.add_argument('--dry-run', action='store_true')
    a = p.parse_args()
    print(json.dumps(sync(a.cloud, a.local, a.dry_run), indent=2))


if __name__=='__main__': main()
