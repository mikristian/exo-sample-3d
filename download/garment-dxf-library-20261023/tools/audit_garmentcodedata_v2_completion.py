#!/usr/bin/env python3
"""Independently audit the saved ETH GarmentCodeData v2 source collection.

No success marker unless every published source archive has a complete,
verified Parquet file, a matching indexed extraction, and a verified pattern
archive with the expected number of source specifications. A fast audit checks
recorded hashes and file sizes; --deep rereads every archive SHA-256.
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from pathlib import Path

from ingest_garmentcodedata_v2 import file_sha256, list_remote_parquets


def audit(root: Path, deep=False, min_specifications=100000):
    dataset_root = root / 'data'
    db = sqlite3.connect(dataset_root/'pattern-index.sqlite3')
    try:
        batches = {(b, n):(sha, size, rows, specs) for b,n,sha,size,rows,specs in
                   db.execute('SELECT body,batch,source_sha256,parquet_bytes,rows_seen,specifications FROM processed_batches')}
        archived = {(b,n):(path,sha,byt,cnt) for b,n,path,sha,byt,cnt in
                    db.execute('SELECT body,batch,cloud_path,archive_sha256,archive_bytes,specification_count FROM archived_batches')}
        counts = {(b,n):cnt for b,n,cnt in
                  db.execute('SELECT body,batch,count(*) FROM patterns GROUP BY body,batch')}
        total = db.execute('SELECT count(*) FROM patterns').fetchone()[0]
    finally:
        db.close()

    expected = list_remote_parquets('both')
    missing=[]
    passed=0
    full_originals=0
    for entry in expected:
        k=(entry['body'],entry['batch'])
        record=batches.get(k)
        archive=archived.get(k)
        original=dataset_root/'original-parquet'/entry['path']
        reasons=[]
        if not record:
            reasons.append('not_indexed')
        elif counts.get(k)!=record[3] or not record[3]:
            reasons.append('indexed_count_mismatch')
        if not archive:
            reasons.append('not_archived')
        elif not record or archive[3]!=record[3]:
            reasons.append('cloud_count_mismatch')
        else:
            path=Path(archive[0])
            if not path.exists() or path.stat().st_size != archive[2]:
                reasons.append('missing_or_short_cloud_archive')
            elif deep and file_sha256(path)!=archive[1]:
                reasons.append('cloud_archive_hash_mismatch')
        if not original.exists() or original.stat().st_size!=entry['size']:
            reasons.append('full_parquet_missing_or_wrong_size')
        elif deep and entry['sha256'] and file_sha256(original)!=entry['sha256']:
            reasons.append('full_parquet_hash_mismatch')
        else:
            full_originals+=1
        if reasons:
            missing.append({'source':entry['path'],'issues':reasons})
        else:
            passed+=1

    if total < min_specifications:
        missing.append({'source':'source-specification-collection',
                        'issues':[f'below_minimum_{min_specifications}_verified_specifications']})
    if len(expected) != 40:
        missing.append({'source':'source-manifest',
                        'issues':[f'expected_40_batches_found_{len(expected)}']})
    return {'schema':'exo.garmentcodedata-v2.complete-audit.v1',
            'verifiedOriginalSewingSpecifications':total,
            'minimumRequiredSpecifications':min_specifications,
            'datasetSourceBatches':len(expected),
            'completeBatches':passed, 'fullParquetFileCount':full_originals,
            'deepHashVerified':bool(deep),
            'allDataSaved':bool(deep) and total >= min_specifications and
                len(expected)==40 and passed==40,
            'incomplete':missing}


def prepare_repairs(root: Path, status):
    """Prepare damaged batches to be reconstructed from verified Parquet.

    Preserve original files instead of deleting them. The next importer pass
    restores extracted JSON and archive bytes, then rechecks their hashes.
    This is invoked ONLY after a full deep audit has failed.
    """
    if not status.get('deepHashVerified') or status.get('allDataSaved'):
        raise ValueError('Repair requires a failed deep validation')
    root = root.resolve()
    recover_archive = {'indexed_count_mismatch','cloud_count_mismatch',
                       'missing_or_short_cloud_archive','cloud_archive_hash_mismatch',
                       'not_archived'}
    quarantined = []
    reset = []
    db = sqlite3.connect(root/'data/pattern-index.sqlite3', timeout=60)
    try:
        for item in status['incomplete']:
            source = item['source']
            parts = Path(source).parts
            if len(parts)!=2 or parts[0] not in ('default_body','random_body') or not parts[1].startswith('batch-') or not parts[1].endswith('.parquet'):
                continue
            body = 'default' if parts[0]=='default_body' else 'random'
            number = parts[1][6:-8]
            if not number.isdigit():
                continue
            batch = int(number)
            issues = set(item['issues'])
            full = root/'data/original-parquet'/source
            if full.exists() and issues.intersection({'full_parquet_missing_or_wrong_size','full_parquet_hash_mismatch'}):
                # A damaged source is never used for the next extraction. Keep
                # the bad bytes for diagnosis without counting them as saved.
                suffix = '.quarantine'
                dest = full.with_name(full.name + suffix)
                serial = 1
                while dest.exists():
                    dest = full.with_name(full.name + suffix + f'.{serial}')
                    serial += 1
                os.replace(full, dest)
                quarantined.append(str(dest))
            if issues.intersection(recover_archive):
                # Drop only completion markers, not source pattern rows or any
                # archive bytes. Re-ingestion reconstructs the JSON and safely
                # replaces a corrupt/missing archive on the next pass.
                db.execute('DELETE FROM archived_batches WHERE body=? AND batch=?', (body,batch))
                db.execute('DELETE FROM processed_batches WHERE body=? AND batch=?', (body,batch))
                reset.append(source)
        db.commit()
    finally:
        db.close()
    return {'resetBatches':reset,'quarantinedSources':quarantined}


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',type=Path,required=True)
    p.add_argument('--deep',action='store_true')
    p.add_argument('--min-specifications',type=int,default=100000)
    p.add_argument('--status-file',type=Path)
    p.add_argument('--prepare-repairs',action='store_true', help='After failed deep validation, quarantine corrupt originals and clear invalid completion markers for safe re-ingestion')
    args=p.parse_args(argv)
    if args.min_specifications < 100000:
        p.error('full 100k+ collection requires at least 100000 records')
    if args.prepare_repairs and not args.deep:
        p.error('--prepare-repairs requires --deep')
    status=audit(args.root,args.deep,args.min_specifications)
    if args.prepare_repairs and not status['allDataSaved']:
        status['preparedRepairs']=prepare_repairs(args.root,status)
    print(json.dumps(status,indent=2))
    if args.status_file:
        args.status_file.write_text(json.dumps(status,indent=2)+'\n')
    return 0 if status['allDataSaved'] else 1


if __name__=='__main__':sys.exit(main())
