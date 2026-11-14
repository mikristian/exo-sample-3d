#!/usr/bin/env python3
"""Read-only checksum audit of EXO's mirrored original sewing JSON archives.

Useful while Jarvis is offline. No original archive, pattern, or model is
edited; status goes to the separate training directory only after a full
streaming SHA256 verification of every indexed archived batch.
"""
from __future__ import annotations

import argparse
from datetime import datetime,timezone
import hashlib
import json
from pathlib import Path
import sqlite3
import os


def audit(root):
    db=sqlite3.connect(root/'pattern-index.sqlite3')
    try:
        rows=db.execute('SELECT body,batch,archive_sha256,archive_bytes,specification_count FROM archived_batches').fetchall()
        indexed=db.execute('SELECT count(*) FROM patterns').fetchone()[0]
        counts={(body,batch):count for body,batch,count in
                db.execute('SELECT body,batch,count(*) FROM patterns GROUP BY body,batch')}
    finally:db.close()
    verified=0;verified_patterns=0;total_bytes=0;issues=[]
    cache=root/'training/remote-archive-cache/archives'
    for body,batch,checksum,size,count in rows:
        archive=cache/body/f'batch-{batch:02d}-specifications.tar.gz'
        if not archive.is_file():
            issues.append(f'missing:{body}/{batch:02d}')
            continue
        if archive.stat().st_size!=size:
            issues.append(f'size-mismatch:{body}/{batch:02d}')
            continue
        digest=hashlib.sha256()
        with archive.open('rb') as stream:
            for chunk in iter(lambda:stream.read(1024*1024),b''):
                digest.update(chunk)
        if digest.hexdigest()!=checksum:
            issues.append(f'sha256-mismatch:{body}/{batch:02d}')
            continue
        if counts.get((body,batch))!=count:
            issues.append(f'index-count-mismatch:{body}/{batch:02d}')
            continue
        verified+=1;verified_patterns+=count;total_bytes+=size
    if indexed!=sum(row[4] for row in rows):
        issues.append('unarchived-or-duplicate-index-patterns')
    return {'schema':'exo.garmentcodedata-v2.cached-archive-audit.v1',
            'checkedAt':datetime.now(timezone.utc).isoformat(),
            'archivedBatchesInIndex':len(rows),
            'verifiedLocalArchiveBatches':verified,
            'verifiedOriginalSpecificationCount':verified_patterns,
            'indexedPatterns':indexed,
            'verifiedCompressedBytes':total_bytes,
            'allArchivesVerified':not issues and verified==len(rows),
            'issues':issues}


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]/
        'download/garment-dxf-library-20261023/garmentcodedata-v2')
    args=parser.parse_args(argv)
    result=audit(args.root.resolve())
    status=args.root/'training/source-cache-audit-status.json'
    status.parent.mkdir(parents=True,exist_ok=True)
    temporary=status.with_suffix('.tmp')
    temporary.write_text(json.dumps(result,indent=2)+'\n')
    os.replace(temporary,status)
    print(json.dumps(result,indent=2))
    return 0 if result['allArchivesVerified'] else 1


if __name__=='__main__':raise SystemExit(main())
