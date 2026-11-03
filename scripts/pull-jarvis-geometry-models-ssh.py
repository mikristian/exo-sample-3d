#!/usr/bin/env python3
"""Mirror only completed, hash-verified Jarvis geometry models to EXO.

The EXO source-importer remains the sole owner of indexed source Parquets.
This sync copies three finished training artifacts (model, embeddings and
manifest), never in-progress partial files or source dataset originals.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

import numpy as np


ROOT=Path(__file__).resolve().parents[1]
LOCAL=ROOT/'download/garment-dxf-library-20261023/garmentcodedata-v2/training'
REMOTE='/Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2/training'
FILES=('geometry-encoder-v1.npz','source-embeddings-v1.npz','training-manifest.json')
QUERY='''import hashlib,json,pathlib
root=pathlib.Path('/Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2/training')
def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as stream:
  for chunk in iter(lambda:stream.read(1048576),b''):h.update(chunk)
 return h.hexdigest()
result=[]
for manifest in sorted(root.glob('remote-geometry-*/training-manifest.json')):
 folder=manifest.parent
 paths=[folder/'geometry-encoder-v1.npz',folder/'source-embeddings-v1.npz',manifest]
 if not all(p.is_file() for p in paths):continue
 try:
  obj=json.loads(manifest.read_text())
  count=obj['trainingExamplesVerified']
  if obj.get('schema')!='exo.garmentcodedata-v2.geometry-training.v1' or count<60000:continue
  result.append({'folder':folder.name,'trainedGarments':count,
    'sha256':{p.name:digest(p) for p in paths}})
 except (KeyError,ValueError,OSError):continue
print(json.dumps(result))
'''


def _hash(path):
    digest=hashlib.sha256()
    with Path(path).open('rb') as source:
        for chunk in iter(lambda:source.read(1024*1024),b''):
            digest.update(chunk)
    return digest.hexdigest()


def validate_model(model_path,embeddings_path,manifest_path,count):
    manifest=json.loads(Path(manifest_path).read_text())
    if (manifest.get('schema')!='exo.garmentcodedata-v2.geometry-training.v1'
        or manifest.get('trainingExamplesVerified')!=count):
        raise ValueError('Unexpected geometry training manifest or verified source count')
    with np.load(model_path,allow_pickle=False) as model:
        shapes={'w1':(39,64),'b1':(64,),'w2':(64,16),'b2':(16,),
                'w3':(16,64),'b3':(64,),'w4':(64,39),'b4':(39,),
                'mean':(39,),'std':(39,),'featureNames':(39,)}
        for key,shape in shapes.items():
            if key not in model or model[key].shape!=shape:
                raise ValueError(f'Invalid geometry checkpoint tensor {key}')
            if key!='featureNames' and not np.isfinite(model[key]).all():
                raise ValueError(f'Non-finite geometry checkpoint tensor {key}')
        if (model['std']<=0).any():raise ValueError('Invalid geometry normalization')
    with np.load(embeddings_path,allow_pickle=False) as embeddings:
        if (embeddings['embeddings'].shape!=(count,16)
            or embeddings['sourceIds'].shape!=(count,)
            or not np.isfinite(embeddings['embeddings']).all()):
            raise ValueError('Incomplete or non-finite original source embeddings')
        if len(set(embeddings['sourceIds']))!=count:
            raise ValueError('Training source identifiers are not unique')


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host',default='100.82.90.101')
    parser.add_argument('--ssh-alias',default='jarviss-macbook-pro')
    args=parser.parse_args(argv)
    if (not re.fullmatch(r'[A-Za-z0-9.-]{1,253}',args.host)
        or not re.fullmatch(r'[A-Za-z0-9._-]{1,253}',args.ssh_alias)):
        parser.error('Invalid SSH address')
    options=['-o',f'HostName={args.host}','-o','BatchMode=yes',
             '-o','ConnectTimeout=8','-o','ServerAliveInterval=8']
    try:
        remote=subprocess.run(['/usr/bin/ssh',*options,args.ssh_alias,
             '/usr/bin/python3','-'],input=QUERY,capture_output=True,text=True,timeout=120)
        if remote.returncode:
            raise OSError(remote.stderr[-1000:])
        entries=json.loads(remote.stdout)
        if not isinstance(entries,list) or len(entries)>20:
            raise ValueError('Unexpected number of completed geometry models')
        mirrored=[]
        for item in entries:
            name=item['folder'];count=item['trainedGarments']
            if (not re.fullmatch(r'remote-geometry-(?:\d+k|full-\d+|deep-\d+)',name)
                or not isinstance(count,int) or count<60000):
                raise ValueError('Unexpected geometry checkpoint name or count')
            hashes=item['sha256']
            destination=LOCAL/name
            if (all((destination/f).is_file() and _hash(destination/f)==hashes[f] for f in FILES)):
                mirrored.append({'name':name,'trainedGarments':count,'state':'already_verified'})
                continue
            destination.mkdir(parents=True,exist_ok=True)
            with tempfile.TemporaryDirectory(prefix='.geometry-mirror-',dir=destination) as temp:
                staging=Path(temp)
                for filename in FILES:
                    expected=hashes[filename]
                    if not re.fullmatch(r'[0-9a-f]{64}',expected):
                        raise ValueError('Invalid remote SHA-256 digest')
                    subprocess.run(['/usr/bin/scp',*options,
                        f'{args.ssh_alias}:{REMOTE}/{name}/{filename}',
                        str(staging/filename)],capture_output=True,check=True,timeout=180)
                    if _hash(staging/filename)!=expected:
                        raise ValueError(f'Geometry transfer checksum mismatch for {filename}')
                validate_model(staging/FILES[0],staging/FILES[1],staging/FILES[2],count)
                # Publish model and embeddings first, commit manifest last.
                for filename in FILES:os.replace(staging/filename,destination/filename)
                mirrored.append({'name':name,'trainedGarments':count,'state':'mirrored_verified'})
        print(json.dumps(mirrored))
        # The existing half-hour geometry mirror LaunchAgent also updates the
        # local whole-corpus coverage certificate, even when the optional
        # standalone coverage LaunchAgent has not yet been installed. Do not
        # let an incomplete audit invalidate a successfully mirrored model.
        auditor=ROOT/'scripts/audit-garmentcodedata-full-training.py'
        if auditor.is_file():
            try:
                audit=subprocess.run([sys.executable,str(auditor)],
                    capture_output=True,text=True,timeout=90)
                if audit.returncode:
                    print('Coverage auditor reported an error: '+audit.stderr[-300:],file=sys.stderr)
            except (OSError,subprocess.TimeoutExpired) as error:
                print('Coverage check deferred: '+str(error)[:300],file=sys.stderr)
        return 0
    except (OSError,ValueError,KeyError,subprocess.TimeoutExpired,
            subprocess.CalledProcessError,json.JSONDecodeError) as error:
        print('Geometry model mirror will retry: '+str(error)[-1000:],file=sys.stderr)
        return 1


if __name__=='__main__':sys.exit(main())
