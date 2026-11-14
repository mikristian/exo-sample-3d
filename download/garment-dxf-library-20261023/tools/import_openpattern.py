#!/usr/bin/env python3
"""Import locally acquired DXFs with explicit user-supplied provenance.

No checkout, license verification, or certification is implied.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
INBOX = ROOT / 'openpattern-inbox'
DEST = ROOT / 'dxf' / 'openpattern-imports'
MANIFEST = ROOT / 'reports' / 'openpattern-files.json'
MAX_FILES = 1000
MAX_FILE = 64 * 1024 * 1024
MAX_TOTAL = 512 * 1024 * 1024
MAX_RATIO = 100


def valid_name(name, directory=False):
    normalized = name[:-1] if directory and name.endswith('/') else name
    path = PurePosixPath(normalized)
    if (not name or '\\' in name or name.startswith('/') or
            ':' in name or any(p in ('', '.', '..') for p in normalized.split('/'))):
        raise ValueError(f'Unsafe archive member: {name!r}')


def candidates(source):
    if source.suffix.lower() == '.dxf':
        if source.stat().st_size > MAX_FILE:
            raise ValueError('DXF exceeds size limit')
        return [(source.name, source.read_bytes())]
    if source.suffix.lower() != '.zip':
        raise ValueError('Input must be .dxf or .zip')
    found, total = [], 0
    with zipfile.ZipFile(source) as archive:
        members = archive.infolist()
        if len(members) > MAX_FILES:
            raise ValueError('ZIP exceeds entry limit')
        for member in members:
            valid_name(member.filename, member.is_dir())
            mode = member.external_attr >> 16
            if stat.S_IFMT(mode) == stat.S_IFLNK:
                raise ValueError('ZIP symlink forbidden')
            if member.flag_bits & 1:
                raise ValueError('Encrypted ZIP forbidden')
            if member.is_dir() or PurePosixPath(member.filename).suffix.lower() != '.dxf':
                continue  # Non-DXF product assets are left compressed and unexamined.
            if member.file_size > MAX_FILE or total + member.file_size > MAX_TOTAL:
                raise ValueError('ZIP exceeds uncompressed size limit')
            if member.file_size and (member.compress_size == 0 or member.file_size / member.compress_size > MAX_RATIO):
                raise ValueError('ZIP compression ratio exceeds limit')
            total += member.file_size
            with archive.open(member) as stream:
                data = stream.read(MAX_FILE + 1)
            if len(data) != member.file_size:
                raise ValueError('ZIP member length mismatch')
            found.append((member.filename, data))
    return found


def import_files(input_path, source, license_text, attribution, manifest=MANIFEST):
    if not all(isinstance(x, str) and x.strip() for x in (source, license_text, attribution)):
        raise ValueError('Source URL/reference, license text, and attribution are mandatory')
    input_path = Path(input_path)
    if not input_path.is_file() or input_path.is_symlink() or not input_path.resolve().is_relative_to(INBOX.resolve()):
        raise ValueError('Input must be a real file within openpattern-inbox')
    if manifest.resolve() != MANIFEST.resolve():
        raise ValueError('Manifest must remain in the controlled reports directory')
    files = candidates(input_path)
    if not files:
        raise ValueError('No DXFs found')
    # Validate all candidate bytes and existing manifests before writing.
    from audit_library import inspect
    entries = json.loads(manifest.read_text()) if manifest.exists() else []
    if not isinstance(entries, list):
        raise ValueError('Invalid manifest')
    existing = {}
    for entry in entries:
        if not isinstance(entry, dict) or not all(entry.get(k) for k in ('filename', 'sha256', 'source', 'license', 'attribution')):
            raise ValueError('Invalid existing manifest record')
        existing[entry['sha256']] = entry
    pending = {}
    for original, data in files:
        valid_name(original)
        if not inspect(data)['envelopeOK']:
            raise ValueError(f'Invalid DXF geometry/envelope: {original}')
        sha = hashlib.sha256(data).hexdigest()
        if sha not in existing and sha not in pending:
            pending[sha] = {'filename': f'dxf/openpattern-imports/{sha}.dxf',
                            'sha256': sha, 'source': source, 'license': license_text,
                            'attribution': attribution, 'originalName': original}
    DEST.mkdir(parents=True, exist_ok=True)
    manifest.parent.mkdir(parents=True, exist_ok=True)
    for sha, entry in pending.items():
        dest = ROOT / entry['filename']
        if dest.is_symlink():
            raise ValueError('Destination symlink forbidden')
        raw = next(blob for _, blob in files if hashlib.sha256(blob).hexdigest() == sha)
        try:
            with dest.open('xb') as handle:
                handle.write(raw)
        except FileExistsError:
            if hashlib.sha256(dest.read_bytes()).hexdigest() != sha:
                raise ValueError(f'Existing destination hash mismatch: {dest}')
    # Existing manifests must describe bytes actually present.
    for entry in entries:
        dest = ROOT / entry['filename']
        if (dest.is_symlink() or not dest.is_file() or
                not dest.resolve().is_relative_to(DEST.resolve()) or
                hashlib.sha256(dest.read_bytes()).hexdigest() != entry['sha256']):
            raise ValueError(f'Existing manifest file invalid: {entry["filename"]}')
    combined = entries + list(pending.values())
    fd, temporary = tempfile.mkstemp(prefix='.openpattern-', dir=manifest.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as handle:
            json.dump(combined, handle, indent=2)
            handle.write('\n')
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, manifest)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return {'newFiles': len(pending), 'duplicates': len(files) - len(pending), 'manifestTotal': len(combined),
            'checkoutCompleted': False, 'factoryCertified': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--source', required=True)
    parser.add_argument('--license', required=True)
    parser.add_argument('--attribution', required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(import_files(args.input, args.source, args.license, args.attribution), indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, json.JSONDecodeError) as error:
        parser.exit(1, f'Import rejected: {error}\n')


if __name__ == '__main__':
    main()
