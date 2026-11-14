#!/usr/bin/env python3
"""Update EXO's local pattern library from the remote Expansion Mac over SSH.

The macOS LaunchAgent may be denied read access to the WebDAV mount by TCC;
this fetches a completed SQLite backup via authenticated SSH instead. Data is
verified locally before being applied, and stale backups cannot overwrite a
newer EXO index.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import subprocess
import tempfile
from pathlib import Path

REMOTE_INDEX = '/Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2/metadata/pattern-index.sqlite3.gz'


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--host', required=True, help='Reachable SSH IP or hostname for Expansion Mac')
    p.add_argument('--ssh-alias', default='jarviss-macbook-pro')
    p.add_argument('--dry-run', action='store_true')
    args = p.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9.-]{1,253}', args.host):
        p.error('Invalid SSH host override')
    if not re.fullmatch(r'[A-Za-z0-9._-]{1,253}', args.ssh_alias):
        p.error('Invalid SSH alias')
    with tempfile.TemporaryDirectory(prefix='exo-gcdv2-remote-index-') as folder:
        compressed = Path(folder) / 'remote-index.sqlite3.gz'
        command = ['/usr/bin/ssh', '-o', f'HostName={args.host}', '-o', 'BatchMode=yes',
                   '-o', 'ConnectTimeout=8', '-o', 'ServerAliveInterval=8',
                   '-o', 'ServerAliveCountMax=2', args.ssh_alias, f'cat {REMOTE_INDEX}']
        with compressed.open('wb') as stream:
            subprocess.run(command, stdout=stream, check=True, timeout=90)
        module_file = Path(__file__).resolve().parent / 'sync-garmentcodedata-v2-catalog-from-expansion.py'
        spec = importlib.util.spec_from_file_location('exo_garmentcode_catalog_sync', module_file)
        loader = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(loader)
        print(json.dumps(loader.sync(compressed,
             Path(__file__).resolve().parents[1] / 'download/garment-dxf-library-20261023/garmentcodedata-v2/pattern-index.sqlite3',
             dry_run=args.dry_run), indent=2))


if __name__ == '__main__':
    main()
