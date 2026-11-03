#!/usr/bin/env python3
"""Resumable, source-verified ingestion of ETH GarmentCodeData v2 pattern JSON.

This importer intentionally retains only the 2D sewing `specification` rows from
the 148 GB third-party Parquet mirror. Other data (meshes, body models, etc.) is
NOT saved by this tool. Nothing generated here is factory/AAMA/ASTM approved.

Usage:
  python3 ingest_garmentcodedata_v2.py --sample-row-file PATH --to-dxf
  python3 ingest_garmentcodedata_v2.py --remote --body default --batch 0
  python3 ingest_garmentcodedata_v2.py --remote --body both --batch all

Remote Parquet mode requires: python3 -m pip install pyarrow
Download archives are staged one at a time and deleted ONLY once fully ingested.
The original JSON specifications and manifest remain permanently in output/.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import importlib.util
import io
import json
import os
import re
import shutil
import sqlite3
import sys
import tarfile
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / 'garmentcodedata-v2'
DATASET = 'chibifire/datasource-garmentcodedata-v2-parquet'
DATASET_DOI = 'https://doi.org/10.3929/ethz-b-000690432'
SOURCE_URL = f'https://huggingface.co/datasets/{DATASET}'
AUTHOR = 'Korosteleva et al., GarmentCodeData v2, ETH Zurich (2024)'
SAFE_ELEMENT = re.compile(r'^[A-Za-z0-9_-]{1,150}$')
CHUNK = 1024 * 1024


def request_json(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'EXO-ClothCraft-GarmentCodeDataV2-import/1.0'})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def validate_record(record):
    if not isinstance(record, dict):
        raise ValueError('Missing pattern record')
    batch, body, element, kind = (record.get(key) for key in ('batch', 'body', 'element', 'kind'))
    if not isinstance(batch, int) or batch < 0 or batch > 1000:
        raise ValueError('Invalid batch')
    if body not in ('default', 'random') or not isinstance(element, str) or not SAFE_ELEMENT.fullmatch(element):
        raise ValueError('Unsafe body/element identifier')
    if kind != 'specification':
        return None
    raw = record['data']
    if isinstance(raw, str):
        raw = base64.b64decode(raw, validate=True)
    if not isinstance(raw, bytes):
        raise ValueError('Expected raw JSON bytes in Parquet, or base64 in viewer')
    expected = record.get('sha256')
    if not isinstance(expected, str) or not re.fullmatch('[0-9a-fA-F]{64}', expected):
        raise ValueError('Missing original file SHA-256')
    if sha256(raw) != expected.lower():
        raise ValueError(f'Checksum mismatch: {element}')
    document = json.loads(raw)
    panels = document.get('pattern', {}).get('panels')
    if not isinstance(panels, dict) or not 1 <= len(panels) <= 400:
        raise ValueError('Invalid garment specification panels')
    for panel in panels.values():
        if not isinstance(panel, dict) or not isinstance(panel.get('vertices'), list) or not isinstance(panel.get('edges'), list):
            raise ValueError('Invalid sewing panel topology')
    return raw, len(panels)


def connect_db(out):
    out.mkdir(parents=True, exist_ok=True)
    # A second independent-body worker may commit alongside the reference-body
    # importer. SQLite WAL serializes the writers; wait rather than failing on
    # momentary batch commit contention.
    db = sqlite3.connect(out / 'pattern-index.sqlite3', timeout=60)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA busy_timeout=60000')
    db.execute('''CREATE TABLE IF NOT EXISTS patterns (
        body TEXT NOT NULL, batch INTEGER NOT NULL, element TEXT NOT NULL,
        sha256 TEXT NOT NULL, bytes INTEGER NOT NULL, panel_count INTEGER NOT NULL,
        source_path TEXT NOT NULL, dxf_path TEXT, dxf_sha256 TEXT,
        source TEXT NOT NULL, license TEXT NOT NULL, attribution TEXT NOT NULL,
        factory_approved INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(body,batch,element))''')
    db.execute('''CREATE TABLE IF NOT EXISTS processed_batches (
        body TEXT NOT NULL, batch INTEGER NOT NULL, source_sha256 TEXT,
        parquet_bytes INTEGER NOT NULL, rows_seen INTEGER NOT NULL,
        specifications INTEGER NOT NULL, PRIMARY KEY(body,batch))''')
    db.execute('''CREATE TABLE IF NOT EXISTS archived_batches (
        body TEXT NOT NULL, batch INTEGER NOT NULL, cloud_path TEXT NOT NULL,
        archive_sha256 TEXT NOT NULL, archive_bytes INTEGER NOT NULL,
        specification_count INTEGER NOT NULL, PRIMARY KEY(body,batch))''')
    db.commit()
    return db


def dxf_from_json(raw):
    """Generic research-only R12: keep untouched JSON for exact source edges/seams."""
    module_path = ROOT / 'tools' / 'convert_garmentcode.py'
    spec = importlib.util.spec_from_file_location('exo_garmentcode_converter', module_path)
    converter = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(converter)
    panels = json.loads(raw)['pattern']['panels']
    translated = []
    offset_x = offset_y = row_height = 0.0
    for i, (name, panel) in enumerate(panels.items()):
        points = converter.sample_panel(panel)
        minx = min(x for x, y in points)
        maxx = max(x for x, y in points)
        miny = min(y for x, y in points)
        maxy = max(y for x, y in points)
        translated.append((name, [(x - minx + offset_x, y - miny + offset_y) for x, y in points]))
        row_height = max(row_height, maxy-miny)
        offset_x += maxx-minx+10
        if (i+1) % 3 == 0:
            offset_x = 0
            offset_y += row_height + 14
            row_height = 0
    return converter.dxf_bytes(translated, set(panels))


def write_atomic(dest, data):
    dest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=dest.parent, prefix='.part-', delete=False) as stream:
        temp_path = Path(stream.name)
        try:
            stream.write(data)
            stream.flush()
            # On the dedicated Expansion Mac the complete SHA-256 verified
            # Parquet source is also retained. The intermediate per-pattern
            # files are re-creatable and independently archived+verified, so
            # avoiding thousands of ExFAT fsync calls is safe in that mode.
            if os.getenv('EXO_GARMENTCODE_FAST_STAGING') != '1':
                os.fsync(stream.fileno())
        except BaseException:
            temp_path.unlink(missing_ok=True)
            raise
    os.replace(temp_path, dest)


def ingest(db, out, record, to_dxf=False):
    validated = validate_record(record)
    if validated is None:
        return False
    raw, panel_count = validated
    body, batch, element = record['body'], record['batch'], record['element']
    digest = sha256(raw)
    relative = Path('specifications') / body / f'batch-{batch:02d}' / f'{element}_specification.json'
    destination = out / relative
    if not destination.exists() or sha256(destination.read_bytes()) != digest:
        write_atomic(destination, raw)
    dxf_path, dxf_sha = None, None
    if to_dxf:
        converted = dxf_from_json(raw)
        dxf_path = str(Path('dxf') / body / f'batch-{batch:02d}' / f'{element}.dxf')
        dxf_sha = sha256(converted)
        dxf_dest = out / dxf_path
        if not dxf_dest.exists() or sha256(dxf_dest.read_bytes()) != dxf_sha:
            write_atomic(dxf_dest, converted)
    db.execute('''INSERT INTO patterns (body,batch,element,sha256,bytes,panel_count,source_path,
        dxf_path,dxf_sha256,source,license,attribution,factory_approved)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0) ON CONFLICT(body,batch,element) DO UPDATE SET
        sha256=excluded.sha256,bytes=excluded.bytes,panel_count=excluded.panel_count,
        source_path=excluded.source_path,
        dxf_path=COALESCE(excluded.dxf_path,patterns.dxf_path),
        dxf_sha256=COALESCE(excluded.dxf_sha256,patterns.dxf_sha256)''',
        (body, batch, element, digest, len(raw), panel_count, relative.as_posix(),
         dxf_path, dxf_sha, SOURCE_URL, 'CC BY 4.0', AUTHOR))
    return True


def ingest_sample_row(db, out, path, to_dxf):
    document = json.loads(path.read_text())
    if not isinstance(document.get('rows'), list):
        raise ValueError('Expected Hugging Face viewer rows response')
    count = 0
    for wrapper in document['rows']:
        count += bool(ingest(db, out, wrapper['row'], to_dxf))
    db.commit()
    return count


def list_remote_parquets(body):
    results = []
    bodies = ['default_body', 'random_body'] if body == 'both' else [body + '_body']
    for group in bodies:
        url = f'https://huggingface.co/api/datasets/{DATASET}/tree/main/{group}?recursive=true&expand=true&limit=100'
        for entry in request_json(url):
            match = re.fullmatch(r'(default_body|random_body)/batch-(\d{2})\.parquet', entry.get('path', ''))
            if not match:
                continue
            lfs = entry.get('lfs') or {}
            results.append({'body': 'default' if match[1] == 'default_body' else 'random',
                            'batch': int(match[2]), 'size': entry['size'],
                            'sha256': lfs.get('oid'), 'path': entry['path']})
    return sorted(results, key=lambda e: (e['body'], e['batch']))


def download_parquet(entry, out, reserve_gb):
    retained = out / 'original-parquet' / entry['path']
    if retained.is_file():
        valid = retained.stat().st_size == entry['size']
        expected = entry.get('sha256')
        if valid and expected and re.fullmatch('[0-9a-f]{64}', expected):
            valid = file_sha256(retained) == expected
        if valid:
            print(f'Reusing complete original Parquet already saved: {retained}', flush=True)
            return retained
        # The primary importer can encounter an incomplete/corrupt original
        # *before* the final deep audit runs. Preserve its bytes and download
        # a clean upstream copy rather than retrying a known bad file forever.
        quarantine = retained.with_name(retained.name + '.quarantine')
        suffix = 1
        while quarantine.exists():
            quarantine = retained.with_name(retained.name + f'.quarantine.{suffix}')
            suffix += 1
        os.replace(retained, quarantine)
        print(f'Quarantined invalid original for clean retry: {quarantine}', flush=True)
    staging = out / '.staging'
    staging.mkdir(parents=True, exist_ok=True)
    part = staging / (entry['path'].replace('/', '-') + '.part')
    total = entry['size']
    if total <= 0:
        raise ValueError('Unknown remote Parquet size: cannot enforce disk guard')
    existing = part.stat().st_size if part.exists() else 0
    if existing > total:
        raise ValueError('Partial download exceeds published file size')
    expected = entry.get('sha256')
    # An interrupted transfer can have *all* bytes on disk but still have the
    # .part filename. Sending Range: bytes=<file-size>- yields HTTP 416 even
    # though the data is COMPLETE. Hash the finished file before making any
    # network request. This fixed the stopped batch-10 import on 2026-11-02.
    if existing == total:
        if expected and re.fullmatch('[0-9a-f]{64}', expected):
            actual = file_sha256(part)
            if actual != expected:
                quarantine = part.with_name(part.name + '.corrupt-' + actual[:12])
                os.replace(part, quarantine)
                raise ValueError(f'Complete partial Parquet SHA-256 differs from source; preserved damaged file at {quarantine}; retry will download a new copy')
        print(f'Completed partial verified from disk without HTTP resume: {part}', flush=True)
        return part
    required = total - existing + int(reserve_gb * 1024**3)
    free = shutil.disk_usage(staging).free
    if free < required:
        raise RuntimeError(f'Insufficient disk space: need {(required/1024**3):.2f} GiB, available {(free/1024**3):.2f} GiB. '
                           'Choose a larger --output volume, or free disk space. Existing saved patterns remain intact.')
    url = f'https://huggingface.co/datasets/{DATASET}/resolve/main/{entry["path"]}?download=true'
    headers = {'User-Agent': 'EXO-ClothCraft-GarmentCodeDataV2-import/1.0'}
    if existing:
        headers['Range'] = f'bytes={existing}-'
    response = urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=180)
    try:
        if existing and response.status != 206:
            raise RuntimeError('Remote server ignored HTTP Range; refusing to corrupt resumed archive')
        if existing:
            returned_range = response.headers.get('Content-Range')
            if returned_range and not returned_range.startswith(f'bytes {existing}-'):
                raise RuntimeError(f'Remote Content-Range does not match persisted partial: {returned_range}')
        with part.open('ab' if existing else 'wb') as dest:
            while True:
                block = response.read(CHUNK)
                if not block:
                    break
                dest.write(block)
    finally:
        response.close()
    if part.stat().st_size != total:
        raise RuntimeError(f'Incomplete Parquet file: {part.stat().st_size}/{total} bytes. Re-run to resume.')
    if expected and re.fullmatch('[0-9a-f]{64}', expected):
        hasher = hashlib.sha256()
        with part.open('rb') as fh:
            for block in iter(lambda: fh.read(CHUNK), b''):
                hasher.update(block)
        if hasher.hexdigest() != expected:
            quarantine = part.with_name(part.name + '.corrupt-' + hasher.hexdigest()[:12])
            os.replace(part, quarantine)
            raise ValueError(f'Downloaded Parquet SHA-256 differs from Hugging Face LFS hash; quarantined at {quarantine}')
    return part


def preserve_full_source_parquet(archive, out, entry):
    """Retain the complete verified row collection, not just 2D JSON panels."""
    original_dest = out / 'original-parquet' / entry['path']
    original_dest.parent.mkdir(parents=True, exist_ok=True)
    if archive.resolve() != original_dest.resolve():
        os.replace(archive, original_dest)
    print(f'Preserved entire SHA-256 verified source Parquet: {original_dest}', flush=True)
    return original_dest


def ingest_parquet_duckdb(db, out, parquet_path, expected_body=None, expected_batch=None, to_dxf=False, memory_limit='1GB'):
    """Bounded-memory scan: filter kind before materializing huge mesh BLOBs.

    Parquet includes 3D meshes, SVGs and small sewing JSON records intermixed.
    DuckDB's late materialization reads just the sewing rows rather than asking
    PyArrow to convert every row's large 3D mesh into a Python object.
    """
    try:
        import duckdb
    except ImportError as exc:
        raise RuntimeError('Install duckdb to run the memory-bounded Parquet extractor') from exc
    source = str(parquet_path)
    # Each Parquet row group can be hundreds of MiB because 3D meshes share
    # the source with 2D specifications. DuckDB needed >384 MiB to filter one
    # real row group; a *single-threaded* 1 GiB budget fits the 8 GiB Mac.
    conn = duckdb.connect(config={'threads': '1', 'memory_limit': memory_limit,
                                  'preserve_insertion_order': 'false'})
    conn.execute('PRAGMA disable_progress_bar')
    count = 0
    pending_commits = 0
    try:
        seen = int(conn.execute('SELECT count(*) FROM read_parquet(?)', [source]).fetchone()[0])
        print(f'DuckDB memory-bounded specification scan: {parquet_path.name} ({seen} source rows)', flush=True)
        result = conn.execute('''SELECT batch,body,element,kind,data,sha256
            FROM read_parquet(?) WHERE kind = 'specification' ''', [source])
        while True:
            rows = result.fetchmany(16)
            if not rows:
                break
            for batch, body, element, kind, data, digest in rows:
                if expected_body and body != expected_body:
                    raise ValueError('Parquet body conflicts with requested batch')
                if expected_batch is not None and batch != expected_batch:
                    raise ValueError('Parquet batch conflicts with requested batch')
                count += bool(ingest(db, out, {
                    'batch':batch,'body':body,'element':element,
                    'kind':kind,'data':data,'sha256':digest}, to_dxf))
                pending_commits += 1
            # Limit costly ExFAT WAL syncs without risking more than one
            # small, restartable checkpoint of original specifications.
            if pending_commits >= 256:
                db.commit()
                pending_commits = 0
        db.commit()
        return seen, count
    finally:
        conn.close()


def ingest_parquet(db, out, parquet_path, expected_body=None, expected_batch=None, to_dxf=False, engine='auto'):
    if engine not in ('auto','duckdb','pyarrow'):
        raise ValueError('Unknown Parquet extractor engine')
    if engine in ('auto','duckdb'):
        try:
            import duckdb  # noqa: F401
        except ImportError:
            if engine == 'duckdb':
                raise RuntimeError('Parquet engine duckdb requested but not installed')
        else:
            # A 3D mesh row group can exceed the first memory budget even
            # after filtering. Retry the *same verified file* with a 2 GiB
            # budget without discarding source files or duplicating index rows.
            # 2 GiB stays below the 8 GiB Mac's memory capacity.
            for memory_limit in ('1GB', '2GB'):
                try:
                    return ingest_parquet_duckdb(db, out, parquet_path,
                        expected_body, expected_batch, to_dxf, memory_limit=memory_limit)
                except duckdb.OutOfMemoryException:
                    db.rollback()
                    print(f'DuckDB row group exceeded {memory_limit}; restarting checked Parquet scan with larger budget', flush=True)
                    if memory_limit == '2GB':
                        raise
    try:
        import pyarrow.parquet as pq
        import pyarrow.compute as pc
    except ImportError as exc:
        raise RuntimeError('Parquet ingestion requires pyarrow (python3 -m pip install pyarrow)') from exc
    count, seen = 0, 0
    source = pq.ParquetFile(parquet_path)
    columns = ('batch', 'body', 'element', 'kind', 'data', 'sha256')
    for arrow_batch in source.iter_batches(batch_size=32, columns=columns):
        seen += arrow_batch.num_rows
        # Do NOT materialize raw PLY meshes into Python objects (3+ GiB/batch)
        # just to discard them: Arrow filters cheaply in native memory first.
        filtered = arrow_batch.filter(pc.equal(arrow_batch.column(3), 'specification'))
        for row in filtered.to_pylist():
            if expected_body and row['body'] != expected_body:
                raise ValueError('Parquet body conflicts with requested batch')
            if expected_batch is not None and row['batch'] != expected_batch:
                raise ValueError('Parquet batch conflicts with requested batch')
            count += bool(ingest(db, out, row, to_dxf))
        if seen % 512 == 0:
            db.commit()
    db.commit()
    return seen, count


def file_sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(CHUNK), b''):
            digest.update(block)
    return digest.hexdigest()


def backup_index_to_cloud(db, out, cloud):
    """Copy a consistent *closed* SQLite backup to WebDAV, never a live WAL file."""
    cloud = cloud.expanduser().resolve()
    target = cloud / 'metadata' / 'pattern-index.sqlite3.gz'
    staging = out / '.staging'
    staging.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=staging, prefix='sqlite-backup-') as temporary:
        work = Path(temporary)
        local_index = work / 'pattern-index.sqlite3'
        local_backup = sqlite3.connect(local_index)
        try:
            db.backup(local_backup)
        finally:
            local_backup.close()
        packed = work / 'pattern-index.sqlite3.gz'
        with local_index.open('rb') as source, packed.open('wb') as destination:
            with gzip.GzipFile(fileobj=destination, mode='wb', filename='', mtime=0) as compressor:
                shutil.copyfileobj(source, compressor, CHUNK)
        expected = file_sha256(packed)
        target.parent.mkdir(parents=True, exist_ok=True)
        temp_remote = target.with_name(target.name + '.uploading')
        shutil.copyfile(packed, temp_remote)
        if file_sha256(temp_remote) != expected:
            raise ValueError('SQLite backup WebDAV readback failed; Mac index retained')
        os.replace(temp_remote, target)
        if file_sha256(target) != expected:
            raise ValueError('SQLite backup post-move readback failed')
        return {'cloudIndex': str(target), 'indexSha256': expected,
                'bytes': packed.stat().st_size}


def archive_to_cloud(db, out, cloud, body, batch, prune_local=False):
    """Copy a verified batch into a portable gzip TAR on a WebDAV/file mount.

    The SQLite index stays local: WebDAV does not support reliable SQLite WAL.
    Source JSON can be pruned locally only after bytewise upload verification.
    """
    rows = db.execute('''SELECT element,source_path,sha256 FROM patterns
                         WHERE body=? AND batch=? ORDER BY element''', (body, batch)).fetchall()
    if not rows:
        raise ValueError(f'No verified specifications indexed for {body}/{batch:02d}')
    cloud = cloud.expanduser().resolve()
    archive_relative = Path('archives') / body / f'batch-{batch:02d}-specifications.tar.gz'
    remote = cloud / archive_relative
    known = db.execute('SELECT archive_sha256,specification_count FROM archived_batches WHERE body=? AND batch=?',
                       (body, batch)).fetchone()
    if known and known[1] == len(rows) and remote.exists() and file_sha256(remote) == known[0]:
        print(f'Cloud archive already verified: {remote}', flush=True)
        return {'remoteArchive': str(remote), 'sha256': known[0], 'sourcePatterns': len(rows)}
    # Prepare locally: one file per pattern, portable to any destination filesystem.
    staging = out / '.staging'
    staging.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=staging, prefix=f'cloud-{body}-{batch:02d}-',
                                     suffix='.tar.gz', delete=False) as temp:
        temporary = Path(temp.name)
    try:
        with temporary.open('wb') as destination:
            with gzip.GzipFile(fileobj=destination, mode='wb', filename='', mtime=0, compresslevel=6) as compressed:
                with tarfile.open(fileobj=compressed, mode='w|') as archive:
                    for element, source_path, expected_hash in rows:
                        source = out / source_path
                        raw = source.read_bytes()
                        if sha256(raw) != expected_hash:
                            raise ValueError(f'Local source missing or altered: {source_path}')
                        info = tarfile.TarInfo(source_path)
                        info.size = len(raw)
                        info.mode = 0o644
                        info.mtime = 0
                        archive.addfile(info, io.BytesIO(raw))
        expected_archive_hash = file_sha256(temporary)
        remote.parent.mkdir(parents=True, exist_ok=True)
        pending = remote.with_name(remote.name + '.uploading')
        # Write to a temp name so failed WebDAV connections never overwrite a verified copy.
        shutil.copyfile(temporary, pending)
        if pending.stat().st_size != temporary.stat().st_size or file_sha256(pending) != expected_archive_hash:
            raise ValueError('Cloud upload checksum mismatch: original local files retained')
        os.replace(pending, remote)
        if file_sha256(remote) != expected_archive_hash:
            raise ValueError('Cloud archive failed post-rename checksum verification')
        db.execute('''INSERT INTO archived_batches VALUES (?,?,?,?,?,?)
            ON CONFLICT(body,batch) DO UPDATE SET cloud_path=excluded.cloud_path,
            archive_sha256=excluded.archive_sha256,archive_bytes=excluded.archive_bytes,
            specification_count=excluded.specification_count''',
            (body, batch, str(remote), expected_archive_hash, temporary.stat().st_size, len(rows)))
        db.commit()
        if prune_local:
            for _, source_path, _ in rows:
                (out / source_path).unlink()
        return {'remoteArchive': str(remote), 'sha256': expected_archive_hash,
                'sourcePatterns': len(rows), 'archiveBytes': temporary.stat().st_size,
                'localSourcesPruned': bool(prune_local)}
    finally:
        temporary.unlink(missing_ok=True)


def report(db, out):
    counts = db.execute('SELECT COUNT(*), SUM(bytes), SUM(dxf_path IS NOT NULL) FROM patterns').fetchone()
    batches = db.execute('SELECT COUNT(*) FROM processed_batches').fetchone()[0]
    archived = db.execute('SELECT COUNT(*),COALESCE(SUM(specification_count),0) FROM archived_batches').fetchone()
    result = {'schema': 'exo.garmentcodedata-v2.intake.v1', 'source': SOURCE_URL,
              'originalDataset': DATASET_DOI, 'license': 'CC BY 4.0', 'attribution': AUTHOR,
              'storedSpecifications': counts[0] or 0, 'sourceBytes': counts[1] or 0,
              'genericDxfConverted': counts[2] or 0, 'completedParquetBatches': batches,
              'cloudArchivedBatches': archived[0], 'cloudArchivedSpecifications': archived[1],
              'factoryApproved': 0, 'aamaAstmCertified': 0,
              'note': 'Counts reflect files actually saved, not the advertised dataset total. '
                      'Research DXF is sampled generic R12 and not production certified.'}
    write_atomic(out / 'intake-status.json', (json.dumps(result, indent=2) + '\n').encode())
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=DEFAULT_OUT)
    parser.add_argument('--sample-row-file', type=Path, help='Ingest viewer JSON previously retrieved from source')
    parser.add_argument('--parquet-file', type=Path, help='Ingest a locally downloaded Parquet archive')
    parser.add_argument('--remote', action='store_true', help='Download sequential Parquet archives, then extract their 2D specifications')
    parser.add_argument('--keep-parquet', action='store_true', help='Preserve verified full source Parquet files (including meshes) in original-parquet/; requires enough output disk space')
    parser.add_argument('--prefetched-only', action='store_true', help='Extract only already verified full Parquet originals; never download another copy')
    parser.add_argument('--no-index-backup', action='store_true', help='Leave publishing the shared cloud SQLite snapshot to the primary importer')
    parser.add_argument('--backfill-existing-parquet', action='store_true', help='Also reacquire full Parquet source for previously indexed batches missing their original archives')
    parser.add_argument('--body', choices=['default','random','both'], default='both')
    parser.add_argument('--batch', default='all', help='Single batch number (0-35) or all')
    parser.add_argument('--to-dxf', action='store_true', help='Also generate generic research-only whole-garment R12 DXF')
    parser.add_argument('--parquet-engine', choices=['auto','duckdb','pyarrow'], default='auto',
                        help='DuckDB uses less RAM on the 8 GB Expansion Mac (default auto)')
    parser.add_argument('--reserve-gb', type=float, default=5.0, help='Minimum free disk space during staged downloads')
    parser.add_argument('--status', action='store_true', help='Show currently saved counts only')
    parser.add_argument('--cloud-output', type=Path,
                        help='Verified writable ExpansionCloud directory for immutable batch TAR archives')
    parser.add_argument('--archive-existing', action='store_true',
                        help='Archive every previously completed downloaded batch to --cloud-output')
    parser.add_argument('--prune-local-after-archive', action='store_true',
                        help='Remove original local JSON only after cloud read-back SHA256 verification')
    args = parser.parse_args(argv)
    if sum(bool(x) for x in (args.sample_row_file, args.parquet_file, args.remote)) > 1:
        parser.error('Choose only one source mode')
    if args.reserve_gb < 1:
        parser.error('Minimum reserve is 1 GiB')
    if args.keep_parquet and not args.remote:
        parser.error('--keep-parquet requires --remote')
    if args.prefetched_only and (not args.remote or not args.keep_parquet):
        parser.error('--prefetched-only requires --remote and --keep-parquet')
    if args.backfill_existing_parquet and not args.keep_parquet:
        parser.error('--backfill-existing-parquet requires --keep-parquet')
    if (args.archive_existing or args.prune_local_after_archive) and not args.cloud_output:
        parser.error('Cloud archive operations require --cloud-output')
    out = args.output.resolve()
    db = connect_db(out)
    try:
        if args.archive_existing:
            batches = db.execute('SELECT body,batch FROM processed_batches ORDER BY body,batch').fetchall()
            for body, batch in batches:
                print(json.dumps(archive_to_cloud(db,out,args.cloud_output,body,batch,
                                                  args.prune_local_after_archive),indent=2), flush=True)
        if args.sample_row_file:
            count = ingest_sample_row(db, out, args.sample_row_file, args.to_dxf)
            print(f'Imported {count} verified specification(s) from viewer rows')
        elif args.parquet_file:
            seen, count = ingest_parquet(db, out, args.parquet_file, to_dxf=args.to_dxf, engine=args.parquet_engine)
            print(f'Inspected {seen} Parquet rows, verified {count} specifications')
        elif args.remote:
            entries = list_remote_parquets(args.body)
            if args.batch != 'all':
                entries = [entry for entry in entries if entry['batch'] == int(args.batch)]
            if not entries:
                raise RuntimeError('No matching remote Parquet archives discovered')
            for i, entry in enumerate(entries, 1):
                body, batch = entry['body'], entry['batch']
                already = db.execute('SELECT 1 FROM processed_batches WHERE body=? AND batch=?', (body, batch)).fetchone()
                if already:
                    if args.keep_parquet and args.backfill_existing_parquet:
                        retained = out / 'original-parquet' / entry['path']
                        # A prior EXO run may already have extracted/archived the
                        # sewing JSON but discarded its source mesh and YAML rows.
                        # Preserve those full upstream files as requested.
                        if not retained.exists() or retained.stat().st_size != entry['size']:
                            preserve_full_source_parquet(download_parquet(entry, out, args.reserve_gb), out, entry)
                    if args.cloud_output:
                        # A prior run may have finished extraction but lost its
                        # WebDAV connection before archive verification. Retry.
                        archived = db.execute('SELECT 1 FROM archived_batches WHERE body=? AND batch=?',
                                              (body, batch)).fetchone()
                        if not archived:
                            print(f'Finish cloud archive of previously extracted {body}/{batch:02d}', flush=True)
                            archive_to_cloud(db, out, args.cloud_output, body, batch,
                                             args.prune_local_after_archive)
                    print(f'Skip previously verified {body}/{batch:02d} ({i}/{len(entries)})', flush=True)
                    continue
                print(f'Acquire {body}/{batch:02d} ({i}/{len(entries)}, {entry["size"]/1024**3:.2f} GiB)', flush=True)
                if args.prefetched_only:
                    ready = out / 'original-parquet' / entry['path']
                    if not ready.is_file() or ready.stat().st_size != entry['size']:
                        print(f'Prefetched source not available yet: {entry["path"]}. Exit gracefully; next pass resumes.', flush=True)
                        break
                archive = download_parquet(entry, out, args.reserve_gb)
                seen, count = ingest_parquet(db, out, archive, body, batch, args.to_dxf, args.parquet_engine)
                db.execute('INSERT INTO processed_batches VALUES (?,?,?,?,?,?)',
                           (body, batch, entry.get('sha256'), entry['size'], seen, count))
                db.commit()
                if args.cloud_output:
                    print(json.dumps(archive_to_cloud(db, out, args.cloud_output, body, batch,
                                                       args.prune_local_after_archive)), flush=True)
                if args.keep_parquet:
                    preserve_full_source_parquet(archive, out, entry)
                else:
                    archive.unlink()  # Safe: original 2D specifications were validated and persisted.
                print(f'Complete {body}/{batch:02d}: {seen} rows, {count} patterns', flush=True)
                report(db, out)
                if args.cloud_output and not args.no_index_backup:
                    backup_index_to_cloud(db, out, args.cloud_output)
        if args.archive_existing and args.cloud_output:
            print(json.dumps(backup_index_to_cloud(db, out, args.cloud_output), indent=2), flush=True)
        print(json.dumps(report(db, out), indent=2))
    finally:
        db.close()


if __name__ == '__main__':
    try:
        main()
    except (OSError, RuntimeError, ValueError, urllib.error.URLError) as error:
        print(f'INGEST FAILED (saved files are preserved): {error}', file=sys.stderr)
        sys.exit(1)
