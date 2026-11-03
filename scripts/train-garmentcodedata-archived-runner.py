#!/usr/bin/env python3
"""Recover 50k+ source JSON archives and retrain EXO's geometry encoder.

Run on the PRIMARY Mac via LaunchAgent, NOT on the 8 GB Expansion Mac. It
reuses the synced read-only index, downloads only small verified spec TARs and
trains on verified sewing geometry; never fetches 3.7 GiB Parquet meshes.
The actual import/supervisor continues independently on Expansion Mac.
"""
from __future__ import annotations

import argparse
from datetime import datetime,timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys

from garmentcode_training_resources import resource_health


ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'download/garment-dxf-library-20261023/garmentcodedata-v2'
MODEL_SCRIPT=ROOT/'download/garment-dxf-library-20261023/tools/train_garmentcode_geometry.py'


def candidates(host,alias):
    opts=['-o','BatchMode=yes','-o','ConnectTimeout=8','-o','ServerAliveInterval=8','-o','ServerAliveCountMax=2']
    return [opts + (['-o',f'HostName={hostname}'] if hostname else []) + [alias]
            for hostname in ([host,None] if host else [None])]


def _hash(path):
    digest=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):
            digest.update(chunk)
    return digest.hexdigest()


def _write_status(path,state,details):
    content={'schema':'exo.garmentcodedata-v2.geometry-auto-training.v1',
             'checkedAt':datetime.now(timezone.utc).isoformat(),
             'state':state,**details}
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix('.tmp')
    temp.write_text(json.dumps(content,indent=2)+'\n')
    temp.replace(path)
    print(json.dumps(content))


def choose_initial_checkpoint(data_root, output):
    """Prefer the latest completed large-data model, else best local v2.

    All paths are local, immutable checkpoints previously verified by the
    model loader. Preserve the original small-data v1/v2 files indefinitely.
    """
    choices=[output/'geometry-encoder-v1.npz',
             data_root/'training/geometry-encoder-v2/geometry-encoder-v1.npz',
             data_root/'training/geometry-encoder-v1/geometry-encoder-v1.npz']
    for candidate in choices:
        if candidate.is_file() and (candidate.parent/'training-manifest.json').is_file():
            return candidate
    return None


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=DATA)
    parser.add_argument('--host',default='100.82.90.101')
    parser.add_argument('--ssh-alias',default='jarviss-macbook-pro')
    parser.add_argument('--minimum-examples',type=int,default=50000)
    parser.add_argument('--retrain-increment',type=int,default=10000)
    parser.add_argument('--epochs',type=int,default=70)
    parser.add_argument('--sync-only',action='store_true',
                        help='Mirror verified original JSON TAR archives, but leave CPU-intensive geometry training on Jarvis')
    args=parser.parse_args(argv)
    root=args.root.expanduser().resolve()
    if not re.fullmatch('[A-Za-z0-9.-]+',args.host) or not re.fullmatch('[A-Za-z0-9._-]+',args.ssh_alias):
        parser.error('Invalid trusted SSH host/alias')
    cache=root/'training/remote-archive-cache'
    # A full-archive model is a new artifact, never an overwrite of the
    # 3,450-source v1/v2 baseline or its original embeddings.
    output=root/'training/geometry-encoder-full-archive'
    status=output/'auto-training-status.json'
    output.mkdir(parents=True,exist_ok=True)
    lock=(output/'auto-train.lock').open('a+')
    try:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:
        print('Another source archive transfer/training pass is already running')
        return 0
    with sqlite3.connect(root/'pattern-index.sqlite3',timeout=10) as db:
        expected=db.execute('SELECT count(*) FROM patterns').fetchone()[0]
        archives=db.execute('''SELECT body,batch,archive_sha256,archive_bytes,
            specification_count FROM archived_batches ORDER BY body,batch''').fetchall()
    available=sum(row[4] for row in archives)
    prior_count=0
    if (output/'training-manifest.json').exists():
        prior=json.loads((output/'training-manifest.json').read_text())
        prior_count=prior.get('trainingExamplesVerified',0)
    threshold=max(args.minimum_examples,prior_count+args.retrain_increment)
    if available<threshold and not args.sync_only:
        _write_status(status,'waiting_for_more_archives',{'verifiedArchivePatterns':available,
            'indexedPatterns':expected,'alreadyTrained':prior_count,'nextRetrainAt':threshold})
        return 0
    to_copy=[]
    for body,batch,sha,size,count in archives:
        target=cache/'archives'/body/f'batch-{batch:02d}-specifications.tar.gz'
        if target.exists() and target.stat().st_size==size and _hash(target)==sha:
            continue
        to_copy.append((body,batch,sha,size,target))
    if to_copy:
        ssh_options=None
        drive_available=False
        for option in candidates(args.host,args.ssh_alias):
            try:
                check=subprocess.run(['/usr/bin/ssh',*option,
                    '/bin/test','-f',
                    '/Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2/data/pattern-index.sqlite3'],
                    stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=25)
            except subprocess.TimeoutExpired:
                continue
            if check.returncode==0:
                ssh_options=option
                drive_available=True
                break
            # A reachable SSH server with no source root is different from
            # an offline Mac; never copy from an unrelated mounted drive.
            if check.returncode==1:
                ssh_options=option
        if ssh_options is None:
            _write_status(status,'waiting_for_expansion_connection',{'verifiedArchivePatterns':available,
                'indexedPatterns':expected,'cachedArchives':len(archives)-len(to_copy),
                'neededArchives':len(to_copy),'alreadyTrained':prior_count})
            return 0
        if not drive_available:
            _write_status(status,'waiting_for_expansion_drive',{'verifiedArchivePatterns':available,
                'indexedPatterns':expected,'cachedArchives':len(archives)-len(to_copy),
                'neededArchives':len(to_copy),'alreadyTrained':prior_count,
                'requiredMount':'/Volumes/Expansion'})
            return 0
        # SCP accepts a file path only assembled from verified index body and
        # batch, not from an external archive cloud_path field.
        for body,batch,sha,size,target in to_copy:
            target.parent.mkdir(parents=True,exist_ok=True)
            temp=target.with_suffix('.download')
            temp.unlink(missing_ok=True)
            remote=f'/Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2/archives/{body}/batch-{batch:02d}-specifications.tar.gz'
            try:
                copy=subprocess.run(['/usr/bin/scp',*ssh_options[:-1],
                    f'{args.ssh_alias}:{remote}',str(temp)],
                    stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=180)
                if copy.returncode!=0:
                    raise OSError(copy.stderr.decode(errors='replace')[-250:])
                if temp.stat().st_size!=size or _hash(temp)!=sha:
                    raise ValueError(f'Failed downloaded source archive checksum: {body}/{batch}')
                os.replace(temp,target)
            except (OSError,ValueError,subprocess.TimeoutExpired) as error:
                temp.unlink(missing_ok=True)
                _write_status(status,'retry_archive_transfer',{'archive':f'{body}/{batch}',
                    'error':str(error)[:300],'alreadyTrained':prior_count})
                return 1

    if args.sync_only:
        _write_status(status,'source_archives_synced',{'verifiedArchivePatterns':available,
            'indexedPatterns':expected,'cachedArchiveBatches':len(archives),
            'alreadyTrained':prior_count,
            'remoteGeometryTraining':'Jarvis, shared resource/CPU lock'})
        return 0
    # Import/indexing happens on the Expansion Mac and may proceed even while
    # the primary Mac is overloaded. Wait for local resources before training.
    resources=resource_health(root)
    if not resources['resourceReady']:
        _write_status(status,'waiting_for_idle_resources',{'verifiedArchivePatterns':available,
            'indexedPatterns':expected,'alreadyTrained':prior_count,
            'nextRetrainAt':threshold,**resources})
        return 0
    # Do not overwrite the working model unless training succeeds. Training
    # saves files atomically only after full masked-geometry evaluation.
    _write_status(status,'training',{'verifiedArchivePatterns':available,
        'indexedPatterns':expected,'alreadyTrained':prior_count,'nextRetrainAt':threshold})
    command=[sys.executable,str(MODEL_SCRIPT),'--root',str(root),
             '--archive-root',str(cache),'--minimum-samples',str(threshold),
             '--epochs',str(args.epochs),'--output',str(output)]
    checkpoint=choose_initial_checkpoint(root,output)
    if checkpoint:
        command.extend(['--resume-from',str(checkpoint),'--learning-rate','0.0005'])
    try:
        run=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                           text=True,timeout=3600)
    except subprocess.TimeoutExpired:
        _write_status(status,'retry_training',{'error':'Training exceeded one hour',
            'alreadyTrained':prior_count})
        return 1
    if run.returncode:
        _write_status(status,'retry_training',{'error':run.stderr[-1500:],
            'alreadyTrained':prior_count})
        return 1
    current=json.loads((output/'training-manifest.json').read_text())
    _write_status(status,'trained',{'trainingExamplesVerified':current['trainingExamplesVerified'],
        'metrics':current['metrics'],'checkpoints':str(output)})
    return 0


if __name__=='__main__':sys.exit(main())
