#!/usr/bin/env python3
"""Create a deterministic, source-only EXO migration research ZIP.

Only selected public documentation/data and the two exact reproducibility
scripts may enter. No media, applications, code blobs beyond the tools,
user paths, credentials, or cloned upstream source are ever included.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import subprocess
import zipfile
from pathlib import Path

PUBLIC_FILE_NAMES = (
  'README.md', 'CODE_DASHBOARD.md', 'TASK_BOARD.md', 'SYSTEM_PLANS.md',
  'PRIORITY_ROADMAP.md', 'RESEARCH_AND_COORDINATION.md', 'RESEARCH_FINDINGS.md', 'METHODOLOGY.md',
  'dashboard.html', 'dashboard-data.json', 'systems.csv',
)
LEGACY_PUBLIC_REFERENCES = (
 'docs/reports/EXO_V2_RUST_ALL_SYSTEMS_PLAN_20261114.md',
 'docs/reports/EXO_V2_RUST_ALL_SYSTEMS_PLAN_20261114.json',
 'docs/reports/EXO_RUST_FIRST_MIGRATION_MILESTONE_20261112.md',
 'docs/reports/EXO_V2_PUBLIC_CANDIDATE_SOURCE_BUILD_QA_20261114.md',
 'docs/reports/EXO_V2_INSTALLED_RUNTIME_SOURCE_PARITY_20261114.md',
)
TOOLS = (
 'scripts/research/build_exo_rust_migration_dashboard.py',
 'scripts/research/build_exo_rust_research_pack.py',
)
PRIVATE_REGEX = (
 re.compile(rb'/Users/[^/\s"<>:]+/'),
 re.compile(rb'[A-Z]:\\\\Users\\\\[^\\\s"<>:]+\\\\'),
 re.compile(rb'-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----'),
 re.compile(rb'(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}'),
 re.compile(rb'sk-(?:proj-)?[A-Za-z0-9_-]{24,}'),
)
ROOT='exo-rust-research-20261114'


def read_public_git(repo:Path,sha:str,path:str)->bytes:
    return subprocess.check_output(['git','-C',str(repo),'show',sha+':'+path])


def sanitize_or_refuse(blob:bytes,path:str)->bytes:
    if b'\x00' in blob:raise RuntimeError('Binary input not allowed: '+path)
    blob=PRIVATE_REGEX[0].sub(b'<LOCAL_HOME>/',blob)
    blob=PRIVATE_REGEX[1].sub(b'<LOCAL_HOME>\\\\',blob)
    # Any credential-bearing file is a hard failure, never an automatic scrub.
    for rx in PRIVATE_REGEX[2:]:
        if rx.search(blob):raise RuntimeError('Potential secret in research input: '+path)
    # Internal build and user-machine paths never belong in an offline public research pack.
    if re.search(rb'/Volumes/(?:Expansion|Untitled)/',blob):
        blob=re.sub(rb'/Volumes/(?:Expansion|Untitled)/[^\s"\']+',b'<LOCAL_BUILD_VOLUME>/',blob)
    if re.search(rb'/Users/[^/\s"<>:]+/',blob):
        raise RuntimeError('Personal path escaped sanitization: '+path)
    return blob


def pack(repo:Path,sha:str,folder:Path,out:Path)->None:
    files={}
    for name in PUBLIC_FILE_NAMES:
        p=folder/name
        if not p.is_file() or p.is_symlink():raise RuntimeError('Missing generated research: '+name)
        files['research/'+name]=sanitize_or_refuse(p.read_bytes(),name)
    for p in TOOLS:
        file=repo/p
        if not file.is_file() or file.is_symlink():raise RuntimeError('Missing controlled tool source: '+p)
        files['tools/'+file.name]=sanitize_or_refuse(file.read_bytes(),p)
    for path in LEGACY_PUBLIC_REFERENCES:
        blob=read_public_git(repo,sha,path)
        if path.endswith('.json'):
            j=json.loads(blob)
            # Do not replicate nonportable developer-checkout paths.
            if isinstance(j.get('upstream'),dict) and j['upstream'].get('localPath'):
                j['upstream']['localPath']='<LOCAL_CHECKOUT_OMITTED>'
            blob=(json.dumps(j,indent=2,sort_keys=True,ensure_ascii=False)+'\n').encode()
        files['references/'+Path(path).name]=sanitize_or_refuse(blob,path)
    overview=(
      '# EXO Rust research pack (source and documentation only)\n\n'
      'EXO public Git source baseline: '+sha+'\n'
      'This offline archive includes the prioritized 41-system task board, Rust-code-percent dashboards, technical migration plan, source accounting, reproducible audit script and five public historical reports.\n'
      'Read `research/README.md` and `research/METHODOLOGY.md` first.\n'
      'Upstream ClothCraft research and task claims are referenced by URL, not duplicated upstream code or nonpublic state.\n'
      'No executable app, CLO3D media, personal computer paths, credentials or user project files are included.\n'
      'Code percentages are source-language share, not feature completion.\n'
    ).encode()
    files['PACK_README.md']=overview
    manifest='\n'.join(hashlib.sha256(contents).hexdigest()+'  '+path for path,contents in sorted(files.items()))+'\n'
    files['MANIFEST_SHA256.txt']=manifest.encode()
    if out.exists(): raise RuntimeError('Refusing to overwrite an existing ZIP')
    out.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9,allowZip64=False) as z:
        for name,blob in sorted(files.items()):
            info=zipfile.ZipInfo(ROOT+'/'+name,date_time=(2026,11,14,12,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=(0o644<<16)
            z.writestr(info,blob,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
    with zipfile.ZipFile(out) as z:
        names=z.namelist()
        if len(names)!=len(files):raise RuntimeError('ZIP member count mismatch')
        for name,blob in files.items():
            if z.read(ROOT+'/'+name)!=blob:raise RuntimeError('ZIP member corrupted: '+name)
    print('SAFE_EXO_RESEARCH_ZIP_CREATED',len(files),'entries',out.stat().st_size,'bytes sha256',hashlib.sha256(out.read_bytes()).hexdigest())


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo',type=Path,default=Path.cwd())
    p.add_argument('--ref',required=True)
    p.add_argument('--source',type=Path,default=Path('docs/rust-migration'))
    p.add_argument('--out',type=Path,default=Path('docs/rust-migration/EXO_RUST_RESEARCH_PACK_20261114.zip'))
    args=p.parse_args()
    if not re.fullmatch(r'[a-f0-9]{40}',args.ref):p.error('Use an immutable 40-character public Git commit')
    repo=args.repo.resolve(strict=True)
    full=subprocess.check_output(['git','-C',str(repo),'rev-parse',args.ref+'^{commit}']).decode().strip()
    if full!=args.ref:p.error('Ref is not a pinned commit')
    pack(repo,full,args.source,args.out)

if __name__=='__main__':main()
