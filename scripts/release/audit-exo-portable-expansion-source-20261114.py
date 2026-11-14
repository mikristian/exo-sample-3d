#!/usr/bin/env python3
"""Verify and optionally redact a dedicated EXO source-only Expansion snapshot.

The input MUST be a newly staged, throwaway Git source directory, never a working
repository, an installed .app, a user project, or an earlier archive. The
resulting manifest contains only relative paths/hashes and never leaks secrets.
This tool does not qualify a native binary or licensed third-party assets.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

PERSONAL_HOME = re.compile(r"/Users/[^/\s\"'<>]+/")
PRIVATE_TOKEN = [
    re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    re.compile(rb"(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}"),
    re.compile(rb"sk-(?:proj-)?[A-Za-z0-9_-]{24,}"),
    re.compile(rb"AKIA[0-9A-Z]{16}"),
]
TEXT_EXT = {
    '.mjs', '.cjs', '.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.htm',
    '.rs', '.cpp', '.cc', '.c', '.hpp', '.h', '.mm', '.swift', '.py', '.sh',
    '.bash', '.toml', '.json', '.yaml', '.yml', '.xml', '.svg', '.md', '.txt',
    '.csv', '.plist', '.wgsl', '.gradle', '.kt', '.lock', '.gitignore',
}
PRIVATE_BINARY = re.compile(r"(?:clo-thomas|clo-hardware-converted|proprietary-clo|clo3d-private)", re.I)
BINARY_EXT = {'.glb', '.gltf', '.obj', '.fbx', '.blend', '.zip', '.dmg', '.app', '.mov', '.mp4', '.png', '.jpg', '.jpeg', '.webp'}

# Follows the application's EXO_PUBLIC_DISTRIBUTION asset policy. Keep the
# permitted MakeHuman neutral collider and first-party source interfaces.
OPTIONAL_PUBLIC_MEDIA = (
    'public/stage-scenes', 'public/hardware-premium', 'public/hangers',
    'public/library-3d', 'public/fabric-scans',
    'public/fabric-scans-ambientcg', 'public/hand-tracking',
    'public/audit-evidence', 'public/avatars/opensew',
    'public/avatars/preview', 'public/garment-previews',
    'public/hardware-thumbnails', 'public/stage-posters',
)


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def sanitize(s: str, suffix: str) -> str:
    if suffix in ('.js','.jsx','.ts','.tsx','.mjs','.cjs'):
        # Preserve quoted JS expression semantics for local paths, while
        # treating URI security tests as non-personal generic fixtures.
        s = re.sub(r'file:///Users/[^/\s\"\']+/', 'file:///home/exo-test-user/', s)
        for q in ("'", '"'):
            rx = re.compile(re.escape(q) + r'/Users/[^/\s\"\']+/([^' + re.escape(q) + r'\n]*)' + re.escape(q))
            s = rx.sub(lambda m: '`${process.env.HOME}/' + m.group(1) + '`', s)
        return PERSONAL_HOME.sub('${EXO_HOME}/', s)
    if suffix in ('.sh', '.bash'):
        return PERSONAL_HOME.sub('${HOME}/', s)
    return PERSONAL_HOME.sub('${EXO_LOCAL_HOME}/', s)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--git-commit', required=True)
    parser.add_argument('--sanitize', action='store_true')
    parser.add_argument('--omit-optional-media', action='store_true')
    args=parser.parse_args()
    src=args.source.resolve(strict=True)
    # A dedicated source-only staging tree, never an installed/working app.
    if src.name != 'source-public-safe' or (src/'.git').exists() or (src/'Contents/MacOS').exists():
        parser.error('Refusing unsafe source path; require new source-public-safe without .git')
    if src in args.manifest.resolve().parents or src == args.manifest.resolve():
        parser.error('Manifest must be outside the source tree')
    omitted=[]
    if args.omit_optional_media:
        if not args.sanitize:
            parser.error('--omit-optional-media requires --sanitize and a fresh source-only directory')
        for relative in OPTIONAL_PUBLIC_MEDIA:
            target=src/relative
            if target.is_symlink():
                raise RuntimeError('Unsafe optional-media symlink: '+relative)
            if target.is_dir():
                if src not in target.resolve().parents:
                    raise RuntimeError('Optional-media path escaped the source directory')
                omitted.extend(p.relative_to(src).as_posix() for p in target.rglob('*') if p.is_file())
                shutil.rmtree(target)
    files=sorted(p for p in src.rglob('*') if p.is_file() and not p.is_symlink())
    manifest={'schema':'exo.portable-source-checkpoint.v1', 'commit':args.git_commit,
              'createdUtc':datetime.now(timezone.utc).isoformat(),
              'scope':'source-only; Git tracked paths selected for EXO build',
              'runtimeInstallerQualified':False,'privateCloAssetsIncluded':False,
              'fileCount':0,'redactedTextFiles':[],'excludedRestrictedMedia':[],
              'excludedOptionalMediaFolders':list(OPTIONAL_PUBLIC_MEDIA) if args.omit_optional_media else [],
              'excludedOptionalMediaFiles':len(omitted),
              'files':{}}
    for p in files:
        relative=p.relative_to(src).as_posix()
        if p.name in ('.env','.DS_Store') or p.name.endswith(('.pem','.p12','.pfx')):
            raise RuntimeError('Blocked potentially sensitive source file: '+relative)
        if PRIVATE_BINARY.search(relative) and p.suffix.lower() in BINARY_EXT:
            if not args.sanitize:
                raise RuntimeError('Restricted CLO media present in snapshot: '+relative)
            p.unlink()
            manifest['excludedRestrictedMedia'].append(relative)
            continue
        if p.suffix.lower() in TEXT_EXT or p.name in ('LICENSE','README','Makefile','.gitignore'):
            data=p.read_bytes()
            for pattern in PRIVATE_TOKEN:
                if pattern.search(data):
                    raise RuntimeError('Potential token/private key in: '+relative)
            try:
                text=data.decode('utf-8')
            except UnicodeDecodeError:
                # Some source fixtures deliberately embed binary bytes.
                continue
            new=sanitize(text,p.suffix.lower())
            if new!=text:
                if not args.sanitize:
                    raise RuntimeError('Personal path present in: '+relative)
                p.write_text(new,encoding='utf-8')
                manifest['redactedTextFiles'].append(relative)
            if PERSONAL_HOME.search(new):
                raise RuntimeError('Unsanitized personal home directory in: '+relative)
        manifest['files'][relative]={'sha256':digest(p),'bytes':p.stat().st_size}
    manifest['fileCount']=len(manifest['files'])
    manifest['redactedFileCount']=len(manifest['redactedTextFiles'])
    args.manifest.parent.mkdir(parents=True,exist_ok=True)
    args.manifest.write_text(json.dumps(manifest,sort_keys=True,indent=2)+'\n')
    print('EXO_EXPANSION_SAFE_SOURCE_PASS',json.dumps({
      'sourceCommit':args.git_commit,'files':manifest['fileCount'],
      'redactions':manifest['redactedFileCount'],
      'excludedRestrictedCloMedia':len(manifest['excludedRestrictedMedia']),
      'excludedOptionalMedia':manifest['excludedOptionalMediaFiles'],
    }))

if __name__=='__main__':main()
