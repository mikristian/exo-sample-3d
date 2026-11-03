#!/usr/bin/env python3
"""Parallel, resumable mirror of *complete* GarmentCodeData v2 Parquet files.

Runs alongside the ONE SQLite ingestion writer. Each source archive has an
independent staging path and SHA256 verification; only a fully verified file is
atomically published to data/original-parquet. The main importer reuses any
prefetched original instead of downloading it twice. This is not a DXF exporter.

  python3 prefetch_garmentcodedata_v2.py --output /Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2/data --workers 2
"""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import shutil
import sys
import time
from pathlib import Path

from ingest_garmentcodedata_v2 import download_parquet, file_sha256, list_remote_parquets


def verify_existing(path, entry):
    if not path.exists():
        return False
    if path.stat().st_size != entry['size']:
        raise ValueError(f'Existing source file has unexpected size: {path}')
    expected = entry.get('sha256')
    if not isinstance(expected, str) or not re.fullmatch(r'[0-9a-fA-F]{64}', expected):
        raise ValueError(f'Missing valid source SHA-256 for {entry["path"]}')
    if file_sha256(path) != expected.lower():
        raise ValueError(f'Existing source file failed source SHA-256: {path}')
    return True


def importer_partial(entry, output):
    return output / '.staging' / (entry['path'].replace('/', '-') + '.part')


def wait_for_importer(entry, output, target, interval=5, idle_checks=3):
    """Yield to a live importer transfer without touching its partial bytes.

    File size is only a progress signal. Completion requires a verified final
    source; if the import stops progressing, let the caller use its own staging.
    """
    partial = importer_partial(entry, output)
    previous_size = None
    idle = 0
    while partial.is_file():
        if verify_existing(target, entry):
            return True
        size = partial.stat().st_size
        if size > entry['size']:
            raise ValueError(f'Importer partial exceeds published size: {partial}')
        if size == previous_size:
            idle += 1
        else:
            idle = 0
        if idle >= idle_checks:
            break
        previous_size = size
        time.sleep(interval)
    return verify_existing(target, entry)


def prefetch_one(entry, output, reserve_gb=10, attempts=40):
    target = output / 'original-parquet' / entry['path']
    if verify_existing(target, entry):
        return {'path': entry['path'], 'status': 'already_verified', 'bytes': target.stat().st_size}
    staging = output / '.prefetch' / f'{entry["body"]}-{entry["batch"]:02d}'
    last_saved_bytes = -1
    stale_attempts = 0
    for attempt in range(attempts):
        try:
            # The importer writes this different staging directory. Never move,
            # truncate or resume its partial from the prefetch worker.
            if wait_for_importer(entry, output, target):
                return {'path': entry['path'], 'status': 'already_verified', 'bytes': target.stat().st_size}
            archive = download_parquet(entry, staging, reserve_gb)
            # The main importer may have completed this source meanwhile.
            if verify_existing(target, entry):
                if archive != target:
                    archive.unlink(missing_ok=True)
                return {'path': entry['path'], 'status': 'already_verified', 'bytes': target.stat().st_size}
            target.parent.mkdir(parents=True, exist_ok=True)
            os.replace(archive, target)
            # Verify again through the permanent path; downloaded files remain
            # available for a restart if the caller disconnects.
            if not verify_existing(target, entry):
                raise ValueError('Prefetched archive missing after transfer')
            try:
                staging.rmdir()  # May still contain .staging; safe to keep it.
            except OSError:
                pass
            return {'path': entry['path'], 'status': 'verified_and_saved', 'bytes': target.stat().st_size}
        except (OSError, RuntimeError, ValueError) as exc:
            partial = staging / '.staging' / (entry['path'].replace('/', '-') + '.part')
            current_bytes = partial.stat().st_size if partial.exists() else 0
            stale_attempts = 0 if current_bytes > last_saved_bytes else stale_attempts + 1
            last_saved_bytes = current_bytes
            if attempt == attempts-1 or stale_attempts >= 8:
                raise RuntimeError(f'{entry["path"]}: {exc}') from exc
            print(f'RETRY {entry["path"]} attempt={attempt+1}, partial={current_bytes}/{entry["size"]}: {exc}', flush=True)
            time.sleep(min(30, 2 * (stale_attempts + 1)))


def select_batches(entries,body=None,first_batch=0,last_batch=19):
    """Limit prefetch to disjoint source batches; never race the importer.

    The one authorized SQLite importer is the only database writer. This
    network-only prefetcher puts fully SHA-verified Parquet originals in their
    final source path atomically; the importer reuses them on its normal pass.
    """
    return [entry for entry in entries if
            (body is None or entry['body']==body)
            and first_batch<=entry['batch']<=last_batch]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--workers', type=int, default=2)
    parser.add_argument('--reserve-gb', type=float, default=10)
    parser.add_argument('--batch-limit', type=int, default=0, help='Optional pilot limit on number of matching source batches')
    parser.add_argument('--only-body',choices=('default','random'),
                        help='Prefetch only one original body family')
    parser.add_argument('--first-batch',type=int,default=0,
                        help='Start batch index, inclusive (default 0)')
    parser.add_argument('--last-batch',type=int,default=19,
                        help='Last batch index, inclusive (default 19)')
    args = parser.parse_args(argv)
    if not 1 <= args.workers <= 4:
        parser.error('workers must be between 1 and 4')
    if args.reserve_gb < 5:
        parser.error('reserve-gb must be at least 5')
    if not 0<=args.first_batch<=args.last_batch<=19:
        parser.error('batch range must be between 00 and 19, inclusive')
    output = args.output.expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    entries = select_batches(list_remote_parquets('both'),
                             args.only_body,args.first_batch,args.last_batch)
    # Source default_body is currently consumed by the sequential index writer.
    # Prefetch the independent adapted-body half first, then backfill full
    # originals for early default-body batches and all remaining gaps.
    entries.sort(key=lambda item: (0 if item['body'] == 'random' else 1,
                                   item['batch'] if item['body'] == 'random' else
                                   (item['batch'] if item['batch'] <= 5 else item['batch']+100)))
    if args.batch_limit:
        entries = entries[:args.batch_limit]
    failures = []
    completed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs = {pool.submit(prefetch_one, entry, output, args.reserve_gb): entry for entry in entries}
        for future in concurrent.futures.as_completed(jobs):
            entry = jobs[future]
            try:
                result = future.result()
                completed += 1
                print('PREFETCH', json.dumps(result), f'({completed}/{len(entries)})', flush=True)
            except Exception as exc:
                failures.append(entry['path'])
                print(f'PREFETCH FAILED {entry["path"]}: {exc}', file=sys.stderr, flush=True)
    print(json.dumps({'sourceArchivesVerified': completed, 'total': len(entries), 'failed': failures}, indent=2))
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
