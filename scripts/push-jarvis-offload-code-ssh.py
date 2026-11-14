#!/usr/bin/env python3
"""Safely reconcile Jarvis trainer scripts after a Tailscale reconnect.

The hourly/15-minute primary-Mac SSH eligibility job calls this before
dispatching heavy compute. It updates ONLY known EXO training scripts using
SHA-256 verification and atomic rename. It never touches source JSON, source
indexes, Parquet ingestion processes, or completed model checkpoints.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys


ROOT=Path(__file__).resolve().parents[1]
TOOLS=ROOT/'download/garment-dxf-library-20261023/tools'
REMOTE='/Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2'
FILES=('remote_garmentcode_dispatch.py',
       'remote_garmentcode_geometry_offload.py',
       'remote_garmentcode_seam_offload.py',
       'remote_garmentcode_seam_select.py',
       'garmentcode_full_source_snapshot.py',
       'prefetch_garmentcodedata_v2.py',
       'train_garmentcode_seams_streaming.py',
       'train_garmentcode_geometry.py')


def files_to_update(local_digests,remote_digests):
    """Only the fixed allowlisted training scripts may be deployed."""
    return [f for f in FILES if local_digests[f]!=remote_digests.get(f)]


def sha256(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):
            h.update(block)
    return h.hexdigest()


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--host',default='100.82.90.101')
    p.add_argument('--ssh-alias',default='jarviss-macbook-pro')
    args=p.parse_args(argv)
    if (not re.fullmatch(r'[A-Za-z0-9.-]{1,253}',args.host)
        or not re.fullmatch(r'[A-Za-z0-9._-]{1,253}',args.ssh_alias)):
        p.error('Invalid SSH target')
    local={f:sha256(TOOLS/f) for f in FILES}
    ssh=['/usr/bin/ssh','-o',f'HostName={args.host}',
         '-o','BatchMode=yes','-o','ConnectTimeout=8',
         '-o','ServerAliveInterval=8','-o','ServerAliveCountMax=1',args.ssh_alias]
    # The probe checks the genuine original index before touching the disk;
    # a missing mount must never result in writing onto the system volume.
    probe='''import hashlib,json,pathlib,sys
root=pathlib.Path('/Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2')
if not (root/'data/pattern-index.sqlite3').is_file():
 print(json.dumps({'mounted':False}));sys.exit(0)
tools=root/'tools'
files=['remote_garmentcode_dispatch.py','remote_garmentcode_geometry_offload.py','remote_garmentcode_seam_offload.py','remote_garmentcode_seam_select.py','garmentcode_full_source_snapshot.py','prefetch_garmentcodedata_v2.py','train_garmentcode_seams_streaming.py','train_garmentcode_geometry.py']
result={}
for name in files:
 f=tools/name
 if f.is_file():result[name]=hashlib.sha256(f.read_bytes()).hexdigest()
print(json.dumps({'mounted':True,'digests':result}))
'''
    try:
        check=subprocess.run([*ssh,'/usr/bin/python3','-'],input=probe,
            capture_output=True,text=True,timeout=90)
        if check.returncode:raise OSError(check.stderr[-600:])
        remote=json.loads(check.stdout)
        if not remote.get('mounted'):
            print('Jarvis original Expansion source drive unavailable; retry later')
            return 1
        pending=files_to_update(local,remote.get('digests',{}))
        if not pending:
            print('Jarvis offload scripts already match locally verified digests')
            return 0
        # Source is mounted and accessible; staging never mutates originals.
        staging=REMOTE+'/tools/.exo-verified-dispatch-staging'
        created=subprocess.run([*ssh,'/bin/mkdir','-p',staging],
            capture_output=True,text=True,timeout=90)
        if created.returncode:raise OSError(created.stderr[-600:])
        subprocess.run(['/usr/bin/scp','-o',f'HostName={args.host}',
            '-o','BatchMode=yes','-o','ConnectTimeout=8',
            *[str(TOOLS/f) for f in pending],
            f'{args.ssh_alias}:{staging}/'],
            check=True,capture_output=True,text=True,timeout=90)
        # Remote verification first checks ALL files, then atomically moves
        # each to the EXO tools folder. Running Python jobs already imported
        # their code; the new files apply to subsequent, not current, runs.
        verify='''import ast,hashlib,json,os,pathlib,sys
root=pathlib.Path('/Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2')
if not (root/'data/pattern-index.sqlite3').is_file():sys.exit('Original source mount disappeared')
expected=json.loads('''+repr(json.dumps({f:local[f] for f in pending}))+''')
staging=root/'tools/.exo-verified-dispatch-staging'
for name,digest in expected.items():
 f=staging/name
 if not f.is_file() or hashlib.sha256(f.read_bytes()).hexdigest()!=digest:
  sys.exit('Checkpoint-safe script transfer failed SHA-256: '+name)
 try:ast.parse(f.read_text(encoding='utf-8'),filename=str(f))
 except (SyntaxError,UnicodeError) as error:
  sys.exit('Refusing to install invalid trainer code '+name+': '+str(error))
for name in expected:os.replace(staging/name,root/'tools'/name)
print(json.dumps({'installedAndVerified':list(expected)}))
'''
        result=subprocess.run([*ssh,'/usr/bin/python3','-'],input=verify,
                              capture_output=True,text=True,timeout=90)
        if result.returncode:raise OSError(result.stderr[-800:])
        print(result.stdout.strip())
        return 0
    except (OSError,ValueError,KeyError,subprocess.TimeoutExpired,
            subprocess.CalledProcessError) as error:
        print('Jarvis safe script deployment deferred: '+str(error)[-500:],file=sys.stderr)
        return 1


if __name__=='__main__':raise SystemExit(main())
