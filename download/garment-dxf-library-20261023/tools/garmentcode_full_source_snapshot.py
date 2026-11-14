"""Determine when ALL original GarmentCodeData v2 Parquet batches are archived.

Both body families contain batches 00..19. Only an exact 40-batch archive
snapshot with matching indexed source counts can trigger final full-source
learning. The trainer still independently checks source JSON SHA-256 digests.
"""
from __future__ import annotations

from pathlib import Path
import sqlite3


EXPECTED={(body,batch) for body in ('default','random') for batch in range(20)}


def full_source_snapshot(index_path:Path):
    with sqlite3.connect(index_path,timeout=30) as db:
        rows=db.execute('SELECT body,batch,specification_count FROM archived_batches').fetchall()
        indexed=db.execute('SELECT COUNT(*) FROM patterns').fetchone()[0]
    actual={(body,batch) for body,batch,_ in rows}
    archived_count=sum(count for _,_,count in rows)
    complete=(len(rows)==len(EXPECTED) and actual==EXPECTED
              and indexed==archived_count and archived_count>100000)
    return {'complete':complete,'archivedBatches':len(rows),
            'expectedBatches':len(EXPECTED),'verifiedArchivedPatterns':archived_count,
            'indexedPatterns':indexed,
            'missingBatches':sorted(f'{b}/{n:02d}' for b,n in EXPECTED-actual)}
